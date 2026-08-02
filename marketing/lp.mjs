// ============================================================
// marketing/lp.mjs
// Twitter用のLP画像（1枚）を書き出す。
//
//   node lp.mjs   → out/lp.png（2400x1350 / 16:9）
//
// 端末に写っているのは**実際のアプリのスクリーンショット**（real/*.png）。
// エミュレーターから adb screencap で撮ったもので、モックではない。
//
// 撮影時、時給設定だけ一時的に引き上げている。実データのままだと
// 「今月あと」が負になり、「あと −2,424円使える」は日本語として
// 成立しないため。支出・予定支出・シフト（Googleカレンダー）には
// 触れておらず、撮影後に元の値へ戻して確認済み（baseline/RESTORE.md）。
//
// 撮り直す手順は README.md を参照。
//
// ヘッドレスChromeはこの環境で動かない（起動中のChromeに吸われて
// 何も出力しない）ため、Playwright同梱のChromiumを使う。
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

// 端末の寸法。スクショは 1080x2400 なので、その比率を保つ。
// 見出しが2行になる列があるぶん、端末は少し小さくして全体を 1350px に収める。
const SCREEN_W = 439;
const SCREEN_H = Math.round((SCREEN_W * 2400) / 1080); // 976
const BEZEL = 12;
const PHONE_W = SCREEN_W + BEZEL * 2;

// 見出しの高さ。1行の列と2行の列が混ざるので、箱の高さを固定して
// 下端で揃える（そうしないと端末の上端がずれる）。
const TITLE_H = 88;

const b64 = (f, mime = 'image/png') =>
  `data:${mime};base64,${readFileSync(f).toString('base64')}`;

const phone = (title, inner) => `
  <div style="display:flex;flex-direction:column;align-items:center;width:${PHONE_W}px">
    <div style="font-size:31px;font-weight:800;color:${C.text};margin-bottom:26px;
      text-align:center;line-height:1.4;letter-spacing:-0.3px;height:${TITLE_H}px;
      display:flex;align-items:flex-end;justify-content:center">${title}</div>
    <div style="width:${PHONE_W}px;height:${SCREEN_H + BEZEL * 2}px;border-radius:50px;
      background:#0E0E0E;padding:${BEZEL}px;box-shadow:0 24px 54px rgba(0,0,0,.18)">
      <div style="width:${SCREEN_W}px;height:${SCREEN_H}px;border-radius:39px;
        overflow:hidden;position:relative;background:#fff">${inner}</div>
    </div>
  </div>`;

const shot = (file) =>
  `<img src="${b64(file)}" style="width:100%;height:100%;display:block;object-fit:cover">`;

// カメラ画面だけは合成する。
// エミュレーターの仮想カメラは「架空の部屋とテストパターン」しか映せず、
// レシートを撮っている画に見えないため。UIの作り（ヘッダー・✕・
// シャッター・キャプション）は実機と同じものを再現し、ファインダーの
// 中身だけ実際に撮ったレシート写真に差し替えている。
// レシート下部（会員Noの下4桁・承認番号・処理通番・AID）は
// 公開素材に載せないよう、あらかじめ切り落としてある。
const cameraPanel = `
  <img src="${b64('real/receipt.jpg', 'image/jpeg')}"
    style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
  <div style="position:absolute;top:0;left:0;right:0;height:72px;background:#fff;
    display:flex;align-items:center;padding:0 22px">
    <span style="font-size:26px;color:#1A1A1A">←</span>
    <span style="font-size:23px;font-weight:700;color:#1A1A1A;margin-left:22px">レシートを撮影</span>
  </div>
  <div style="position:absolute;top:92px;left:18px;width:46px;height:46px;border-radius:23px;
    background:rgba(0,0,0,.5);display:grid;place-items:center;color:#fff;font-size:22px">✕</div>
  <div style="position:absolute;left:0;right:0;bottom:34px;text-align:center">
    <div style="width:84px;height:84px;border-radius:42px;background:${C.primary};
      border:6px solid #fff;margin:0 auto;box-shadow:0 3px 12px rgba(0,0,0,.35)"></div>
    <div style="font-size:19px;color:#fff;margin-top:12px;
      text-shadow:0 1px 5px rgba(0,0,0,.7)">タップして撮影</div>
  </div>`;

const panels = [
  ['今月あと、いくら使える？', shot('real/home.png')],
  ['Googleカレンダーから、<br>給料を自動で予測。', shot('real/shifts.masked.png')],
  ['レシートは、撮るだけ。', cameraPanel],
  ['先の出費も、織り込み済み。', shot('real/planned.masked.png')],
];

const html = `<!doctype html><meta charset="utf-8">
<style>
  *{box-sizing:border-box}
  html,body{margin:0}
  body{width:2400px;height:1350px;background:${C.paper};font-family:${FONT};
    color:${C.text};display:flex;flex-direction:column;align-items:center;padding:46px 0 0}
</style>
<div style="text-align:center;margin-bottom:30px">
  <div style="font-size:76px;font-weight:800;letter-spacing:2px;line-height:1">
    らく〜<span style="color:${C.primary}">ぼ</span></div>
  <div style="font-size:32px;color:${C.sub};margin-top:14px;letter-spacing:1px">
    バイト代から逆算する、学生のための家計簿</div>
</div>
<div style="display:flex;gap:86px;align-items:flex-start">
  ${panels.map(([t, inner]) => phone(t, inner)).join('')}
</div>`;

mkdirSync('out', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 2400, height: 1350 },
  deviceScaleFactor: 1,
});
await page.setContent(html);
await page.screenshot({ path: 'out/lp.png' });
await browser.close();
console.log('✓ out/lp.png (2400x1350)');
