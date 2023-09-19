module.exports = {
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
      isolatedModules: true,
    },
  },
  moduleFileExtensions: [
    "ts",
    "js",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  testMatch: [
    "**/tests/**/*.test.(ts|js)",
  ],
  testEnvironment: "node",
  setupFilesAfterEnv: [
    "jest-extended",
    "./tests/test-helpers/jest-extensions.ts",
  ],
};
