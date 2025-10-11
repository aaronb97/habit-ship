module.exports = {
  extends: ['crema'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  rules: {
    'sort-imports': ['off'],
    'import/order': ['off'],
    '@stylistic/padding-line-between-statements': ['warn'],
  },
  settings: {
    'import/ignore': ['react-native'],
  },
};
