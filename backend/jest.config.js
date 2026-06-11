module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.[jt]s'],
  testTimeout: 15000,
  transform: {
    '^.+\\.[jt]s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};
