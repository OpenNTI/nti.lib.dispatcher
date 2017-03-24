/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';


export default {
	entry: 'src/index.js',
	format: 'cjs',
	dest: 'lib/index.js',
	sourceMap: true,
	exports: 'named',
	external: [
		'flux',
		'invariant',
	],
	plugins: [
		babel({ exclude: 'node_modules/**' }),
		commonjs({
			ignoreGlobal: true
		}),
		json()
	]
};
