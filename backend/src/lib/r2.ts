import type { Env } from '../types';

/**
 * Cloudflare R2 にレシート画像をアップロードする。
 * キー形式: receipts/{userId}/{timestamp}.jpg
 * @returns アップロードしたオブジェクトキー
 */
export async function uploadReceiptToR2(
  env: Env,
  userId: string,
  imageBuffer: ArrayBuffer,
): Promise<string> {
  const timestamp = Date.now();
  const key = `receipts/${userId}/${timestamp}.jpg`;

  await env.R2_BUCKET.put(key, imageBuffer, {
    httpMetadata: {
      contentType: 'image/jpeg',
    },
  });

  return key;
}
