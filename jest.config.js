export default {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleNameMapper: {
		'^Src/(.*)$': '<rootDir>/src/$1',
		'^Src$': '<rootDir>/src',
	},
}
