import type { OcrResult } from '../types';

const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const PROMPT = `Analyze this receipt image and return ONLY a valid JSON object with no other text or markdown.
Required fields:
- store_name: string
- date: string in YYYY-MM-DD format (use today if unknown)
- items: array of {name: string, price: number}
- total_amount: number
- category: exactly one of "食費","交通費","娯楽","衣類","医療","教育・書籍","カフェ・飲み物","家賃・光熱費","日用品","その他"
- payment_method: exactly one of "cash","card","qr"
- points_earned: number or null

Return only the JSON object, no explanation.`;

type AiRun = (model: string, input: { prompt: string; image: number[] }) => Promise<{ response?: string }>;

export async function analyzeReceiptWithCloudflareAI(
  ai: Ai,
  imageBase64: string,
): Promise<OcrResult> {
  const binaryString = atob(imageBase64);
  const uint8Array = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }
  const imageArray = [...uint8Array];

  const MAX_RETRIES = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await (ai.run as AiRun)(MODEL, { prompt: PROMPT, image: imageArray });

      const text = response?.response;
      if (!text) throw new Error('Cloudflare AI からの応答が空です');

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`JSON を抽出できませんでした: ${text.slice(0, 200)}`);

      const result = JSON.parse(jsonMatch[0]) as OcrResult;
      if (result.points_earned === undefined) result.points_earned = null;

      return result;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof Error && (err as { retryable?: boolean }).retryable === true;
      if (!isRetryable || attempt === MAX_RETRIES) break;
      console.warn(`Cloudflare AI attempt ${attempt} failed, retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  throw lastError;
}
