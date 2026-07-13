/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 30000,
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
        },
        target: 'es2022',
      },
      module: {
        type: 'commonjs',
      },
    }],
    '^.+\\.jsx?$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'ecmascript',
        },
        target: 'es2022',
      },
      module: {
        type: 'commonjs',
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
};
