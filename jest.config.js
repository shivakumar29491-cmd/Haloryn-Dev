module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  setupFilesAfterEnv: ["<rootDir>/test/setupTests.js"],
  moduleDirectories: ["node_modules", "web/node_modules"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest"
  },
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/test/__mocks__/styleMock.js",
    "^react$": "<rootDir>/web/node_modules/react",
    "^react-dom$": "<rootDir>/web/node_modules/react-dom"
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/build/",
    "/web/node_modules/",
    "/electron/node_modules/"
  ],
  modulePathIgnorePatterns: ["<rootDir>/electron/package.json"],
  testMatch: ["**/__tests__/**/*.[jt]s?(x)"]
};
