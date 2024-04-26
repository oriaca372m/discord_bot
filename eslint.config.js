import eslint from '@eslint/js'
import globals from 'globals'

import tseslint from 'typescript-eslint'
import jest from 'eslint-plugin-jest'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
	{
		ignores: ['dist/'],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	eslintConfigPrettier,
	{
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-empty-interface': 'off',
		},
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ['**/*.js'],
		...tseslint.configs.disableTypeChecked,
	},
	{
		files: ['**/*.test.ts'],
		...jest.configs['flat/recommended'],
		...jest.configs['flat/style'],
	}
)
