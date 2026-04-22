// ============================================================
// tailwind.config.js
// NativeWind v4 向け Tailwind CSS 設定
// ============================================================

/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 はコンテンツに app/** と screens/** を含める
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './widgets/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [
    // NativeWind v4 のプリセット
    require('nativewind/preset'),
  ],
  theme: {
    extend: {
      colors: {
        // アプリのプライマリカラー（緑）
        primary: '#22c55e',
        // 危険・エラー色（赤）
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};
