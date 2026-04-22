// ============================================================
// babel.config.js
// NativeWind v4 + Expo Router 向けの Babel 設定
// ============================================================

module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // NativeWind v4 は jsxImportSource で className を処理
          jsxImportSource: 'nativewind',
        },
      ],
    ],
    plugins: [
      // NativeWind v4 の Babel プラグイン
      'nativewind/babel',
      // パスエイリアス（@/ → ./）
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
          },
        },
      ],
    ],
  };
};
