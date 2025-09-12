module.exports = {
  extends: ['crema'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    browser: true,
    es2021: true,
  },
  settings: {
    'import/ignore': ['react-native'],
  },
};
