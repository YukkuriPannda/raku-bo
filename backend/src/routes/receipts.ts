import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createSupabaseClient } from '../lib/supabase';
import { uploadReceiptToR2 } from '../lib/r2';
import { analyzeReceiptWithGemini } from '../lib/gemini';
import { analyzeReceiptWithGroq } from '../lib/groq';
import type { OcrResult } from '../types';

const receipts = new Hono<{ Bindings: Env; Variables: Variables }>();

/** レシート画像のデコード後サイズ上限（10MB） */
const MAX_IMAGE_BASE64_BYTES = 10 * 1024 * 1024;
/** base64 は元データの約4/3の長さになる */
const MAX_IMAGE_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BASE64_BYTES * 4) / 3);

/**
 * POST /receipts
 * Content-Type: multipart/form-data
 * Body: { image: File }
 *
 * 処理フロー:
 * 1. 画像を受け取る
 * 2. R2へのアップロードとGemini(→Groq→ダミー)OCRを並列実行
 *    （R2キーはOCRの入力ではなく、後段のINSERTでしか使わないため待つ必要がない）
 * 3. receiptsテーブルにINSERT
 * 4. 結果を返す
 */
receipts.post('/', async (c) => {
  const userId = c.get('userId');

  // JSON body から base64 画像を取得
  let imageBase64: string;
  try {
    const body = await c.req.json<{ image: string }>();
    imageBase64 = body.image;
    if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
      throw new Error('image field missing');
    }
  } catch {
    return c.json({ error: '画像データが含まれていません（フィールド: image, base64文字列）' }, 400);
  }

  // サイズ上限。モバイル側で撮影解像度を長辺1600pxに絞ったため、通常ここに来る
  // base64 は数百KB程度に収まる（10MBはそれよりずっと大きい安全マージン）。
  // ただし pictureSize が取得できない端末やギャラリー経由の画像など、絞り切れない
  // 入力は残るため上限自体は下げない。デコードは1バイトずつのループで入力サイズに
  // 比例してCPU時間を消費するので、上限がないと巨大な入力で使い切れてしまう。
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return c.json(
      { error: `画像が大きすぎます（上限 ${Math.floor(MAX_IMAGE_BASE64_BYTES / 1024 / 1024)}MB）` },
      413,
    );
  }

  // base64 → ArrayBuffer
  // 不正な base64 では atob が例外を投げるため、400 で返す（未捕捉だと 500 になる）
  let imageBuffer: ArrayBuffer;
  try {
    const binaryString = atob(imageBase64);
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    imageBuffer = uint8Array.buffer;
  } catch {
    return c.json({ error: '画像データが正しい base64 形式ではありません' }, 400);
  }

  try {
    // R2アップロードとOCRは互いの結果を必要としない（R2のキーはOCRの入力ではなく、
    // 後段の receipts テーブルへの insert でしか使わない）ため、直列で待たずに
    // 同時に開始する。OCR側は Gemini → Groq → ダミーデータのフォールバックを
    // 内部で完結させ、reject せず必ず解決する Promise にしてから Promise.all に渡す。
    // こうしないと、R2 が先に失敗して Promise.all が即座に reject した後、
    // まだ pending の OCR 側が後から reject したときに unhandled rejection になりうる。
    const r2Promise = uploadReceiptToR2(c.env, userId, imageBuffer);

    // OCR: Gemini → Groq → ダミーデータの順でフォールバック
    const ocrPromise: Promise<OcrResult> = (async () => {
      try {
        return await analyzeReceiptWithGemini(c.env.GEMINI_API_KEY, imageBase64);
      } catch (geminiError) {
        console.warn('Gemini API 失敗、Groq にフォールバック:', geminiError);
        try {
          if (!c.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY 未設定');
          return await analyzeReceiptWithGroq(c.env.GROQ_API_KEY, imageBase64);
        } catch (groqError) {
          console.warn('Groq API も失敗、ダミーデータで続行:', groqError);
          const today = new Date().toISOString().split('T')[0];
          return {
            store_name: '店名不明',
            date: today,
            items: [{ name: '商品', price: 0 }],
            total_amount: 0,
            category: 'その他',
            payment_method: 'cash',
          };
        }
      }
    })();

    const [r2Key, ocrResult] = await Promise.all([r2Promise, ocrPromise]);

    // receipts テーブルに保存
    const supabase = createSupabaseClient(c.env);

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: userId,
        image_url: r2Key,
        raw_ocr_result: ocrResult,
      })
      .select()
      .single();

    if (receiptError) {
      console.error('receiptsテーブルへの保存エラー:', receiptError);
      return c.json({ error: 'レシートの保存に失敗しました' }, 500);
    }

    // OCR結果とreceipt_idを返す（確認画面でユーザーが編集後にPOST /transactionsを呼ぶ）
    return c.json({
      receipt_id: receipt.id,
      ocr_result: ocrResult,
    }, 201);
  } catch (error) {
    // 詳細（R2 / Supabase の生のエラー文）はログにのみ残す。
    // クライアントに返すとテーブル名やエラーコードが外部に漏れる。
    console.error('レシート処理エラー:', error);
    return c.json({ error: '処理中にエラーが発生しました' }, 500);
  }
});

export default receipts;
