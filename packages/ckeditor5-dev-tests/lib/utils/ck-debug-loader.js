/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * The loader matches sentences like: `// @if CK_DEBUG // someDebugCode();` and uncomment them.
 * It also uncomments code after specific flags if they are provided to the webpack configuration.
 * E.g. if the `CK_DEBUG_ENGINE` flag is set to true, then all lines starting with
 * `// @if CK_DEBUG_ENGINE //` will be uncommented.
 *
 * @param {String} source
 * @param {any} map
 */
module.exports = function ckDebugLoader( source, map ) {
	source = source.replace( /\/\/ @if (!?[\w]+) \/\/(.+)/g, ( match, flagName, body ) => {
		// `this.query` comes from the webpack loader configuration.

		// Do not uncomment the code if the flag is missing / falsy.
		if ( !this.query.debugFlags.includes( flagName ) ) {
			return match;
		}

		// Uncomment the code with a same length string to not break the source maps.
		return `/* @if ${ flagName } */ ${ body }`;
	} );

	this.callback( null, source, map );
};
