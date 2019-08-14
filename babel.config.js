module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: false,
      },
    ],
  ],
  plugins: [
    '@babel/plugin-transform-runtime',
    '@babel/plugin-syntax-dynamic-import',
  ],
  comments: false,
  env: {
    test: {
      plugins: [
        '@babel/plugin-syntax-dynamic-import',
      ],
    },
  },
};
