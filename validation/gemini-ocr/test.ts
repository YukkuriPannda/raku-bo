/**
 * Gemini 2.5 Flash OCR 検証スクリプト
 * 使い方: GEMINI_API_KEY=xxx npx tsx gemini-ocr/test.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM 環境での __dirname 代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-preview-04-17';
const SAMPLE_IMAGE_PATH = path.join(__dirname, 'sample.jpg');

// ---------------------------------------------------------------------------
// OcrResult 型（TypeScript）
// ---------------------------------------------------------------------------
interface OcrItem {
  name: string;
  price: number;
}

interface OcrResult {
  store_name: string;
  date: string;                    // YYYY-MM-DD 形式
  items: OcrItem[];
  total_amount: number;
  category:
    | '食費'
    | '交通費'
    | '娯楽'
    | '衣類'
    | '医療'
    | '教育・書籍'
    | 'カフェ・飲み物'
    | '家賃・光熱費'
    | '日用品'
    | 'その他';
  payment_method: 'cash' | 'card' | 'qr';
  points_earned?: number | null;
}

// ---------------------------------------------------------------------------
// OcrResult の JSON Schema（Gemini の responseSchema に渡す）
// ---------------------------------------------------------------------------
const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    store_name: { type: 'string' },
    date: { type: 'string', description: 'YYYY-MM-DD 形式' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'integer' },
        },
        required: ['name', 'price'],
      },
    },
    total_amount: { type: 'integer' },
    category: {
      type: 'string',
      enum: [
        '食費',
        '交通費',
        '娯楽',
        '衣類',
        '医療',
        '教育・書籍',
        'カフェ・飲み物',
        '家賃・光熱費',
        '日用品',
        'その他',
      ],
    },
    payment_method: { type: 'string', enum: ['cash', 'card', 'qr'] },
    points_earned: { type: ['integer', 'null'] },
  },
  required: [
    'store_name',
    'date',
    'items',
    'total_amount',
    'category',
    'payment_method',
  ],
};

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // --- 環境変数チェック ---
  if (!GEMINI_API_KEY) {
    console.error('[ERROR] 環境変数 GEMINI_API_KEY が設定されていません。');
    console.error('  実行例: GEMINI_API_KEY=xxx npx tsx gemini-ocr/test.ts');
    process.exit(1);
  }

  // --- サンプル画像チェック ---
  if (!fs.existsSync(SAMPLE_IMAGE_PATH)) {
    console.warn('[SKIP] sample.jpg が見つかりません。');
    console.warn(`  配置先: ${SAMPLE_IMAGE_PATH}`);
    console.warn('  レシートの画像を上記パスに配置してから再実行してください。');
    process.exit(0);
  }

  console.log(`[INFO] モデル    : ${MODEL}`);
  console.log(`[INFO] 画像ファイル: ${SAMPLE_IMAGE_PATH}`);

  // --- 画像を base64 にエンコード ---
  const imageBuffer = fs.readFileSync(SAMPLE_IMAGE_PATH);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/jpeg';

  // --- Gemini API リクエスト組み立て ---
  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
          {
            text: [
              'このレシート画像を解析してください。',
              '店名、日付（YYYY-MM-DD）、購入品目と金額、合計金額、カテゴリ、支払い方法、獲得ポイント数を抽出してください。',
              '支払い方法は cash（現金）、card（クレジット/デビット）、qr（QRコード決済）のいずれかで答えてください。',
              'カテゴリは提供するスキーマの enum から最も適切なものを選んでください。',
            ].join(' '),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RECEIPT_SCHEMA,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  console.log('[INFO] Gemini API にリクエスト送信中...');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.error('[ERROR] ネットワークエラー:', err);
    process.exit(1);
  }

  // --- レスポンス処理 ---
  const rawJson = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    console.error(`[ERROR] API エラー (HTTP ${response.status}):`);
    console.error(JSON.stringify(rawJson, null, 2));
    process.exit(1);
  }

  // Gemini のレスポンス構造: candidates[0].content.parts[0].text
  const candidates = rawJson.candidates as Array<{
    content: { parts: Array<{ text: string }> };
    finishReason?: string;
  }> | undefined;

  if (!candidates || candidates.length === 0) {
    console.error('[ERROR] candidates が空です。レスポンス全体:');
    console.error(JSON.stringify(rawJson, null, 2));
    process.exit(1);
  }

  const textContent = candidates[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    console.error('[ERROR] text コンテンツが取得できませんでした。レスポンス全体:');
    console.error(JSON.stringify(rawJson, null, 2));
    process.exit(1);
  }

  // --- JSON パース ---
  let ocrResult: OcrResult;
  try {
    ocrResult = JSON.parse(textContent) as OcrResult;
  } catch (err) {
    console.error('[ERROR] レスポンスの JSON パースに失敗しました。');
    console.error('  受信テキスト:', textContent);
    process.exit(1);
  }

  // --- 結果表示 ---
  console.log('\n========== OCR 結果 ==========');
  console.log(JSON.stringify(ocrResult, null, 2));
  console.log('================================\n');

  // --- 簡易バリデーション ---
  const requiredKeys: (keyof OcrResult)[] = [
    'store_name',
    'date',
    'items',
    'total_amount',
    'category',
    'payment_method',
  ];
  const missingKeys = requiredKeys.filter((k) => !(k in ocrResult));
  if (missingKeys.length > 0) {
    console.warn('[WARN] 以下の必須フィールドが欠けています:', missingKeys);
  } else {
    console.log('[OK] 必須フィールドがすべて含まれています。');
  }

  // finishReason の確認
  const finishReason = candidates[0]?.finishReason;
  if (finishReason && finishReason !== 'STOP') {
    console.warn(`[WARN] finishReason = ${finishReason}（STOP 以外は注意）`);
  }

  console.log('[INFO] 検証完了。');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
