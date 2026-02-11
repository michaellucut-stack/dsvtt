module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['auth', 'map', 'chat', 'dice', 'game', 'lobby', 'config', 'ai', 'db', 'infra', 'ci', 'init', 'deps'],
    ],
  },
};
