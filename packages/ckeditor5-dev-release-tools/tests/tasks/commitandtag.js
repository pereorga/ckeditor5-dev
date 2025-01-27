/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

'use strict';

const { expect } = require( 'chai' );
const mockery = require( 'mockery' );
const sinon = require( 'sinon' );

describe( 'commitAndTag()', () => {
	let stubs, commitAndTag;

	beforeEach( () => {
		mockery.enable( {
			useCleanCache: true,
			warnOnReplace: false,
			warnOnUnregistered: false
		} );

		stubs = {
			tools: {
				shExec: sinon.stub().resolves()
			},
			glob: {
				glob: sinon.stub().returns( [] )
			}
		};

		mockery.registerMock( '@ckeditor/ckeditor5-dev-utils', {
			tools: stubs.tools
		} );
		mockery.registerMock( 'glob', stubs.glob );

		commitAndTag = require( '../../lib/tasks/commitandtag' );
	} );

	afterEach( () => {
		mockery.deregisterAll();
		mockery.disable();
		sinon.restore();
	} );

	it( 'should not create a commit and tag if there are no files modified', async () => {
		await commitAndTag( {} );

		expect( stubs.tools.shExec.called ).to.equal( false );
	} );

	it( 'should allow to specify custom cwd', async () => {
		stubs.glob.glob.resolves( [ 'package.json' ] );

		await commitAndTag( { version: '1.0.0', cwd: 'my-cwd' } );

		expect( stubs.tools.shExec.firstCall.args[ 1 ].cwd ).to.deep.equal( 'my-cwd' );
		expect( stubs.tools.shExec.secondCall.args[ 1 ].cwd ).to.deep.equal( 'my-cwd' );
		expect( stubs.tools.shExec.thirdCall.args[ 1 ].cwd ).to.deep.equal( 'my-cwd' );
	} );

	it( 'should add provided files to git one by one', async () => {
		stubs.glob.glob.resolves( [
			'package.json',
			'README.md',
			'packages/custom-package/package.json',
			'packages/custom-package/README.md'
		] );

		await commitAndTag( {
			version: '1.0.0',
			files: [ 'package.json', 'README.md', 'packages/*/package.json', 'packages/*/README.md' ]
		} );

		expect( stubs.tools.shExec.callCount ).to.equal( 6 );
		expect( stubs.tools.shExec.getCall( 0 ).args[ 0 ] ).to.equal( 'git add package.json' );
		expect( stubs.tools.shExec.getCall( 1 ).args[ 0 ] ).to.equal( 'git add README.md' );
		expect( stubs.tools.shExec.getCall( 2 ).args[ 0 ] ).to.equal( 'git add packages/custom-package/package.json' );
		expect( stubs.tools.shExec.getCall( 3 ).args[ 0 ] ).to.equal( 'git add packages/custom-package/README.md' );
	} );

	it( 'should set correct commit message', async () => {
		stubs.glob.glob.resolves( [ 'package.json' ] );

		await commitAndTag( { version: '1.0.0', packagesDirectory: 'packages' } );

		expect( stubs.tools.shExec.secondCall.args[ 0 ] ).to.equal( 'git commit --message "Release: v1.0.0." --no-verify' );
	} );

	it( 'should set correct tag', async () => {
		stubs.glob.glob.resolves( [ 'package.json' ] );

		await commitAndTag( { version: '1.0.0', packagesDirectory: 'packages' } );

		expect( stubs.tools.shExec.thirdCall.args[ 0 ] ).to.equal( 'git tag v1.0.0' );
	} );
} );
