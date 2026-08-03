// ============================================================
// marketing/story.mjs
// Instagram ストーリーズ用の画像（1080x1920 / 9:16）を書き出す。
//
//   node story.mjs   → out/story.png
//
// 素材は lp.mjs と同じ real/*.masked.png（実際のアプリ画面）。
// マスクの内容は mask.py を参照。
//
// **上下それぞれ約250pxはInstagramのUI（プロフィール表示・返信欄）に
// 隠れる。** そこに文字を置かないこと。下側はリンクステッカーを
// 貼る場所としても空けてある。
//
// 横並び4枚のLPをそのまま縦にはできないので、伝える内容を1つに絞り、
// 主役の2画面（残り使える額 / シフトからの給料予測）だけを載せている。
// ストーリーズは数秒しか見られないため、詰め込むと何も残らない。
// ============================================================

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const C = {
  primary: '#1B7F4F',
  text: '#141414',
  sub: '#6B7280',
  paper: '#F4F2EE',
};

const FONT = `"Yu Gothic UI","Yu Gothic","Meiryo","Hiragino Kaku Gothic ProN",sans-serif`;

const SAFE = 250; // 上下のUIに隠れる領域
const SCREEN_W = 400;
const SCREEN_H = Math.round((SCREEN_W * 2400) / 1080); // 889
const BEZEL = 11;

const b64 = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;

const phone = (file) => `
  <div style="width:${SCREEN_W + BEZEL * 2}px;height:${SCREEN_H + BEZEL * 2}px;
    border-radius:46px;background:#0E0E0E;padding:${BEZEL}px;
    box-shadow:0 20px 44px rgba(0,0,0,.20)">
    <img src="${b64(file)}" style="width:${SCREEN_W}px;height:${SCREEN_H}px;
      border-radius:36px;display:block;object-fit:cover">
  </div>`;

const html = `<!doctype html><meta charset="utf-8">
<style>
  *{box-sizing:border-box}
  html,body{margin:0}
  body{width:1080px;height:1920px;background:${C.paper};font-family:${FONT};
    color:${C.text};display:flex;flex-direction:column;align-items:center;
    padding:${SAFE}px 0}
</style>

<div style="text-align:center">
  <div style="font-size:72px;font-weight:800;letter-spacing:2px;line-height:1">
    らく〜<span style="color:${C.primary}">ぼ</span></div>
  <div style="font-size:29px;color:${C.sub};margin-top:14px;letter-spacing:1px">
    バイト代から逆算する、学生のための家計簿</div>
</div>

<div style="font-size:52px;font-weight:800;margin-top:42px;letter-spacing:-1px">
  今月あと、いくら使える？</div>

<div style="display:flex;gap:34px;margin-top:38px">
  ${phone('real/home.png')}
  ${phone('real/shifts.masked.png')}
</div>

<div style="font-size:31px;color:${C.sub};margin-top:40px;text-align:center;line-height:1.6">
  Googleカレンダーのシフトから今月のバイト代を自動計算。<br>
  支出と予定を引いた“あと使える額”だけを見せます。</div>

<div style="margin-top:auto;font-size:36px;font-weight:800;color:${C.primary}">
  Androidテスター募集中</div>`;

mkdirSync('out', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
});
await page.setContent(html);
await page.screenshot({ path: 'out/story.png' });
await browser.close();
console.log('✓ out/story.png (1080x1920)');
