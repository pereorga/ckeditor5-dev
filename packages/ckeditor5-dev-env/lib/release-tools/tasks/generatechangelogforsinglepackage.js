/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

'use strict';

const fs = require( 'fs' );
const { Readable } = require( 'stream' );
const { tools, stream, logger } = require( '@ckeditor/ckeditor5-dev-utils' );
const chalk = require( 'chalk' );
const conventionalChangelogWriter = require( 'conventional-changelog-writer' );
const semver = require( 'semver' );
const cli = require( '../utils/cli' );
const changelogUtils = require( '../utils/changelog' );
const displayCommits = require( '../utils/displaycommits' );
const getPackageJson = require( '../utils/getpackagejson' );
const getNewVersionType = require( '../utils/getnewversiontype' );
const getCommits = require( '../utils/getcommits' );
const getWriterOptions = require( '../utils/transform-commit/getwriteroptions' );
const { getRepositoryUrl } = require( '../utils/transform-commit/transform-commit-utils' );
const transformCommitForSubRepositoryFactory = require( '../utils/transform-commit/transformcommitforsubrepositoryfactory' );

/**
 * Generates the changelog based on commit messages in a package that is located under current work directory (cwd).
 *
 * If the package does not have any commit, the user has to confirm whether the changelog should be generated.
 *
 * @param {Object} [options={}] Additional options.
 *
 * @param {Boolean} [options.skipLinks=false] If set on true, links to release or commits will be omitted.
 *
 * @param {String} [options.from] A commit or tag name that will be the first param of the range of commits to collect.
 *
 * @param {Boolean} [options.highlightsPlaceholder=false] Whether to add a note about release highlights.
 *
 * @param {Boolean} [options.collaborationFeatures=false] Whether to add a note about collaboration features.
 *
 * @returns {Promise}
 */
module.exports = function generateChangelogForSinglePackage( options = {} ) {
	const log = logger();
	const pkgJson = getPackageJson();

	logProcess( chalk.bold( `Generating changelog for "${ chalk.underline( pkgJson.name ) }"...` ) );

	const transformCommit = transformCommitForSubRepositoryFactory( {
		returnInvalidCommit: true
	} );

	logProcess( 'Collecting all commits since the last release...' );

	const commitOptions = {
		from: options.from ? options.from : 'v' + pkgJson.version
	};

	// Initial release.
	if ( semver.eq( pkgJson.version, '0.0.1' ) ) {
		commitOptions.from = null;
	}

	// Collection of all entries (real commits + additional "fake" commits extracted from descriptions).
	let allCommits;

	// A new version inserted into the changelog.
	let newVersion;

	return getCommits( transformCommit, commitOptions )
		.then( commits => {
			allCommits = commits;

			logInfo( `Found ${ commits.length } entries to parse.`, { indentLevel: 1 } );
		} )
		.then( () => {
			logProcess( 'Preparing new version for the package...' );

			const releaseType = getNewVersionType( allCommits );

			displayCommits( allCommits, { indentLevel: 1 } );

			return cli.provideVersion( pkgJson.version, releaseType, { indentLevel: 1 } );
		} )
		.then( version => {
			if ( version === 'skip' ) {
				return Promise.resolve();
			}

			const isInternalRelease = version === 'internal';

			if ( version === 'internal' ) {
				version = semver.inc( pkgJson.version, 'patch' );
			}

			newVersion = version;

			logProcess( 'Generating the changelog...' );

			const commitStream = new Readable( { objectMode: true } );
			commitStream._read = function() {};

			const previousTag = commitOptions.from ? 'v' + pkgJson.version : null;

			const writerContext = {
				version,
				commit: 'commit',
				repoUrl: getRepositoryUrl(),
				currentTag: 'v' + version,
				previousTag,
				isPatch: semver.diff( version, pkgJson.version ) === 'patch',
				isInternalRelease,
				highlightsPlaceholder: Boolean( options.highlightsPlaceholder ),
				collaborationFeatures: Boolean( options.collaborationFeatures ),
				skipCommitsLink: Boolean( options.skipLinks ),
				skipCompareLink: Boolean( options.skipLinks )
			};

			const writerOptions = getWriterOptions( {
				// We do not allow modifying the commit hash value by the generator itself.
				hash: hash => hash
			} );

			const publicCommits = [ ...allCommits ]
				.filter( commit => commit.isPublicCommit )
				.map( commit => {
					commit.scope = null;
					commit.notes = commit.notes.map( note => {
						note.scope = null;

						return note;
					} );

					return commit;
				} );

			for ( const commit of publicCommits ) {
				commitStream.push( commit );
			}

			commitStream.push( null );

			return new Promise( ( resolve, reject ) => {
				commitStream
					.pipe( conventionalChangelogWriter( writerContext, writerOptions ) )
					.pipe( stream.noop( changes => {
						logInfo( 'Changes based on commits have been generated.', { indentLevel: 1 } );
						resolve( changes.toString() );
					} ) )
					.on( 'error', reject );
			} );
		} )
		.then( changesFromCommits => {
			logProcess( 'Saving changelog...' );

			if ( !fs.existsSync( changelogUtils.changelogFile ) ) {
				logInfo( 'Changelog file does not exist. Creating...', { isWarning: true, indentLevel: 1 } );

				changelogUtils.saveChangelog( changelogUtils.changelogHeader );
			}

			let currentChangelog = changelogUtils.getChangelog();

			// Remove header from current changelog.
			currentChangelog = currentChangelog.replace( changelogUtils.changelogHeader, '' );

			// Concat header, new and current changelog.
			let newChangelog = changelogUtils.changelogHeader + changesFromCommits + currentChangelog.trim();
			newChangelog = newChangelog.trim() + '\n';

			// Save the changelog.
			changelogUtils.saveChangelog( newChangelog );

			tools.shExec( `git add ${ changelogUtils.changelogFile }`, { verbosity: 'error' } );
			tools.shExec( 'git commit -m "Docs: Changelog. [skip ci]"', { verbosity: 'error' } );

			logInfo( 'Saved.', { indentLevel: 1 } );
		} )
		.then( () => {
			logInfo( `Changelog for "${ chalk.underline( pkgJson.name ) }" (v${ newVersion }) has been generated.` );
		} );

	function logProcess( message ) {
		log.info( '\n📍 ' + chalk.cyan( message ) );
	}

	/**
	 * @param {String} message
	 * @param {Object} [options={}]
	 * @param {Number} [options.indentLevel=0]
	 * @param {Boolean} [options.startWithNewLine=false] Whether to append a new line before the message.
	 * @param {Boolean} [options.isWarning=false] Whether to use `warning` method instead of `log`.
	 */
	function logInfo( message, options = {} ) {
		const indentLevel = options.indentLevel || 0;
		const startWithNewLine = options.startWithNewLine || false;
		const method = options.isWarning ? 'warning' : 'info';

		log[ method ]( `${ startWithNewLine ? '\n' : '' }${ ' '.repeat( indentLevel * cli.INDENT_SIZE ) }` + message );
	}
};
