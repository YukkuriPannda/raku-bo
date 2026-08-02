import type { OcrResult } from '../types';

// gemini-2.0-flash は無料枠の割り当てが 0 になり、
// 「Quota exceeded ... limit: 0」で常に429を返すようになったため移行した
// （時間を置いても回復しない）。`-latest` エイリアスは常に現行世代を指すため、
// 同じ理由で個別バージョンが打ち切られても影響を受けにくい。
//
// flash ではなく flash-lite を使う理由:
// 実物のレシートを長辺1600pxにして同じプロンプト・同じ RESPONSE_SCHEMA で
// 計測したところ、応答は flash 4246ms に対し flash-lite 1631ms（各3回の中央値、
// flash は別計測の4340msとも一致）で **2.6倍速い**。この1枚では店名・日付・品目・
// 金額・支払方法すべて両者とも正解だった。
//
// ただし精度を比べられたのは**きれいなレシート1枚だけ**で、ブレや縮小で
// どちらが先に崩れるかは未検証（APIの無料枠を使い切って測り切れなかった）。
// 実運用で読み取り精度が落ちるようなら、ここを 'gemini-flash-latest' に戻せばよい。
// 失敗しても呼び出し側に Groq → ダミーデータのフォールバックがある。
const MODEL = 'gemini-flash-lite-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** Gemini への JSON Schema（構造化出力用） */
const RESPONSE_SCHEMA = {
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
          price: { type: 'number' },
        },
        required: ['name', 'price'],
      },
    },
    total_amount: { type: 'number' },
    category: {
      type: 'string',
      enum: ['食費', '交通費', '娯楽', '衣類', '医療', '教育・書籍', 'カフェ・飲み物', '家賃・光熱費', '日用品', 'その他'],
    },
    payment_method: {
      type: 'string',
      enum: ['cash', 'card', 'qr'],
    },
  },
  required: ['store_name', 'date', 'items', 'total_amount', 'category', 'payment_method'],
};

/**
 * base64エンコードされたJPEG画像を Gemini Flash API に送り、
 * レシートのOCR結果を OcrResult 型で返す。
 */
export async function analyzeReceiptWithGemini(
  apiKey: string,
  imageBase64: string,
): Promise<OcrResult> {
  const body = {
    contents: [
      {
        parts: [
          {
            text: `このレシートの画像を解析して、以下の情報をJSON形式で返してください。
- store_name: 店名
- date: 購入日（YYYY-MM-DD形式）
- items: 購入品目（name と price の配列）
- total_amount: 合計金額（数値）
- category: カテゴリ（食費/交通費/娯楽/衣類/医療/教育・書籍/カフェ・飲み物/家賃・光熱費/日用品/その他）
- payment_method: 支払方法（cash=現金/card=クレジットカード・デビットカード/qr=QRコード決済）

日付が不明な場合は今日の日付を使用してください。`,
          },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: RESPONSE_SCHEMA,
    },
  };

  // APIキーは ?key= ではなくヘッダで渡す。
  // クエリに載せるとログやトレースにURLごと残る可能性がある
  // （wrangler.toml で Workers Logs の保持を有効にしている）。
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API エラー: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates: Array<{
      content: { parts: Array<{ text: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API からの応答が空です');
  }

  const result = JSON.parse(text) as OcrResult;

  return result;
}
