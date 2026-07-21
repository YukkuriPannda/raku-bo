import type { OcrResult } from '../types';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const PROMPT = `このレシート画像を解析して、以下のフィールドを持つ有効なJSONオブジェクトのみを返してください。説明文やマークダウンは不要です。

必須フィールド:
- store_name: string（店名）
- date: string（YYYY-MM-DD形式、不明な場合は今日の日付）
- items: {name: string, price: number}の配列
- total_amount: number（合計金額）
- category: "食費","交通費","娯楽","衣類","医療","教育・書籍","カフェ・飲み物","家賃・光熱費","日用品","その他" のいずれか
- payment_method: "cash","card","qr" のいずれか

JSONオブジェクトのみ返してください。`;

export async function analyzeReceiptWithGroq(
  apiKey: string,
  imageBase64: string,
): Promise<OcrResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API エラー: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq からの応答が空です');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`JSON 抽出失敗: ${text.slice(0, 200)}`);

  const result = JSON.parse(jsonMatch[0]) as OcrResult;

  return result;
}
