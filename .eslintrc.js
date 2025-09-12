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
  rules: {
    '@stylistic/jsx-newline': [
      'error',
      { prevent: false, allowMultilines: false },
    ],
  },
  settings: {
    'import/ignore': ['react-native'],
  },
};
