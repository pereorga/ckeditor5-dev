/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

'use strict';

const fs = require( 'fs' );
const upath = require( 'upath' );

/**
 * Returns object from `package.json`.
 *
 * This function is helpful for testing the whole process. Allows mocking the file
 * instead of create the fixtures.
 *
 * @param {String} [cwd=process.cwd()] Where to look for package.json.
 * @returns {Object}
 */
module.exports = function getPackageJson( cwd = process.cwd() ) {
	let pkgJsonPath = cwd;

	if ( !pkgJsonPath.endsWith( 'package.json' ) ) {
		pkgJsonPath = upath.join( cwd, 'package.json' );
	}

	return JSON.parse( fs.readFileSync( pkgJsonPath, 'utf-8' ) );
};
