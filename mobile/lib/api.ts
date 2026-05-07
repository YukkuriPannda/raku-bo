// ============================================================
// lib/api.ts
// axios インスタンス + API クライアント関数
// ============================================================

import axios from 'axios';
import { supabase } from './auth';
import type { CreateTransactionData } from '@/types';

// ============================================================
// axios インスタンス
// ============================================================
export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ------------------------------------------------------------
// リクエストインターセプター
// Supabase JWT を Authorization ヘッダにセット
// ------------------------------------------------------------
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ------------------------------------------------------------
// レスポンスインターセプター（エラーログ用）
// ------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: 401 の場合はサインアウト処理を追加
    console.error('[API Error]', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// ============================================================
// レシート API
// ============================================================
export const receiptApi = {
  /** レシート画像をアップロードして OCR 解析結果を取得 */
  upload: (formData: FormData) =>
    api.post('/receipts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ============================================================
// トランザクション API
// ============================================================
export const transactionApi = {
  /** 指定月のトランザクション一覧を取得（month: "YYYY-MM"） */
  list: (month: string) =>
    api.get('/transactions', { params: { month } }),

  /** トランザクションを新規作成 */
  create: (data: CreateTransactionData) =>
    api.post('/transactions', data),
};

// ============================================================
// 残高 API
// ============================================================
export const balanceApi = {
  /** 指定月の残高データを取得（month: "YYYY-MM"） */
  get: (month: string) =>
    api.get('/balance', { params: { month } }),
};

// ============================================================
// シフト API（Google Calendar 連携）
// ============================================================
export const shiftApi = {
  /** 指定月のシフト一覧を取得
   * @param month "YYYY-MM" 形式
   * @param googleAccessToken Google OAuth のアクセストークン
   */
  list: (month: string, googleAccessToken: string) =>
    api.get('/shifts', {
      params: { month },
      headers: { 'X-Google-Access-Token': googleAccessToken },
    }),
};

// ============================================================
// ポイント API
// ============================================================
export const pointApi = {
  /** ポイント一覧を取得 */
  list: () => api.get('/points'),

  /** ポイントを新規追加 */
  create: (data: { name: string; amount: number; rate: number }) =>
    api.post('/points', data),

  /** ポイント保有数を更新 */
  update: (id: string, amount: number) =>
    api.patch(`/points/${id}`, { amount }),

  /** ポイントを削除 */
  delete: (id: string) => api.delete(`/points/${id}`),
};
