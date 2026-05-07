import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createSupabaseClient } from '../lib/supabase';
import { uploadReceiptToR2 } from '../lib/r2';
import { analyzeReceiptWithGemini } from '../lib/gemini';

const receipts = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /receipts
 * Content-Type: multipart/form-data
 * Body: { image: File }
 *
 * 処理フロー:
 * 1. 画像を受け取る
 * 2. R2にアップロード
 * 3. Geminiに送ってOCR解析
 * 4. transactionsテーブルにINSERT（receiptsテーブルにも保存）
 * 5. 結果を返す
 */
receipts.post('/', async (c) => {
  const userId = c.get('userId');

  // multipart/form-data から画像を取得
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'リクエストの解析に失敗しました' }, 400);
  }

  const imageFile = formData.get('image');
  // Cloudflare Workers の FormData では File は Blob として扱われる
  if (!imageFile || typeof imageFile === 'string') {
    return c.json({ error: '画像ファイルが含まれていません（フィールド名: image）' }, 400);
  }

  // ファイルを ArrayBuffer に変換（Blob として扱う）
  const imageBuffer = await (imageFile as Blob).arrayBuffer();

  try {
    // 1. R2 にアップロード
    const r2Key = await uploadReceiptToR2(c.env, userId, imageBuffer);

    // 2. base64 に変換して Gemini OCR
    const uint8Array = new Uint8Array(imageBuffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const imageBase64 = btoa(binaryString);
    const ocrResult = await analyzeReceiptWithGemini(c.env.GEMINI_API_KEY, imageBase64);

    // 3. receipts テーブルに保存（トランザクション作成は確認画面から行う）
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
    console.error('レシート処理エラー:', error);
    const message = error instanceof Error ? error.message : '不明なエラー';
    return c.json({ error: `処理中にエラーが発生しました: ${message}` }, 500);
  }
});

export default receipts;
