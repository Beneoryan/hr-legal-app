module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    'quotes': ['error', 'single', {allowTemplateLiterals: true}],
    'max-len': ['warn', {code: 120}],
    'indent': ['error', 2],
    'object-curly-spacing': ['error', 'never'],
    'require-jsdoc': 'off',
    'valid-jsdoc': 'off',
    'comma-dangle': ['error', 'always-multiline'],
  },
};
