export default {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/**/*.test.js',
    '!server/__tests__/**',
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.test.js',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
};
