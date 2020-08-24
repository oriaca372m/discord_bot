module.exports = {
	'env': {
		'es6': true,
		'node': true
	},
	'extends': [
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:@typescript-eslint/recommended-requiring-type-checking',
		'plugin:jest/recommended',
		'plugin:jest/style',
		'plugin:prettier/recommended',
		'prettier/@typescript-eslint'
	],
	'globals': {
		'Atomics': 'readonly',
		'SharedArrayBuffer': 'readonly'
	},
	'parser': '@typescript-eslint/parser',
	'parserOptions': {
		'ecmaVersion': 2018,
		'sourceType': 'module',
		'project': './tsconfig.json'
	},
	'plugins': [
		'@typescript-eslint',
		'jest'
	],
	'rules': {
		'@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }]
	}
}
