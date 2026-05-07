import type { OcrResult } from '../types';

const MODEL = 'gemini-2.5-flash-preview-04-17';
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
    points_earned: { type: 'number', nullable: true },
  },
  required: ['store_name', 'date', 'items', 'total_amount', 'category', 'payment_method'],
};

/**
 * base64エンコードされたJPEG画像をGemini 2.5 Flash APIに送り、
 * レシートのOCR結果を OcrResult 型で返す。
 */
export async function analyzeReceiptWithGemini(
  apiKey: string,
  imageBase64: string,
): Promise<OcrResult> {
  const url = `${ENDPOINT}?key=${apiKey}`;

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
- points_earned: 獲得ポイント数（ポイント情報がない場合はnull）

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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  // points_earned が undefined の場合は null に統一
  if (result.points_earned === undefined) {
    result.points_earned = null;
  }

  return result;
}
