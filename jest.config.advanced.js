/**
 * Advanced Jest Configuration
 * 
 * Enhanced configuration for comprehensive testing with:
 * - Better output formatting
 * - Coverage reporting
 * - Performance metrics
 * - Custom reporters
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/__tests__/advanced/test-reporter.ts'],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/__tests__/advanced/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'json',
    'lcov',
  ],
  verbose: true,
  maxWorkers: '50%',
  testTimeout: 30000,
  reporters: [
    'default',
    // HTML reporter disabled - install jest-html-reporters if needed
    // [
    //   'jest-html-reporters',
    //   {
    //     publicPath: './test-results',
    //     filename: 'test-report.html',
    //     expand: true,
    //     hideIcon: false,
    //     pageTitle: 'Holdwall POS - Advanced Test Report',
    //   },
    // ],
  ],
};

module.exports = createJestConfig(customJestConfig);
