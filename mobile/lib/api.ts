// ============================================================
// lib/api.ts
// axios インスタンス + API クライアント関数
// ============================================================

import axios from 'axios';
import { supabase } from './auth';
import type {
  CreateTransactionData,
  UpdateTransactionData,
  CreateSubscriptionData,
  CreateCalendarExpenditureData,
} from '@/types';

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
    console.error('[API Error]', error.response?.status, error.response?.data, 'code:', error.code, 'msg:', error.message);
    return Promise.reject(error);
  }
);

// ============================================================
// レシート API（base64 JSON 送信 - Expo Go の file:// URI 制限を回避）
// ============================================================
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export const receiptApi = {
  upload: async (base64: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? '';

    const res = await fetch(`${BASE_URL}/receipts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64 }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error ?? 'upload failed'), { response: { status: res.status, data: err } });
    }

    return { data: await res.json() };
  },
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

  /** トランザクションを更新 */
  update: (id: string, data: UpdateTransactionData) =>
    api.patch(`/transactions/${id}`, data),

  /** トランザクションを削除 */
  delete: (id: string) => api.delete(`/transactions/${id}`),
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
// プロフィール API
// ============================================================
export const profileApi = {
  get: () => api.get('/profile'),
  update: (data: { hourly_wage?: number; shift_keywords?: string[] }) =>
    api.patch('/profile', data),
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

// ============================================================
// 予定された支出 API
// ============================================================
export const plannedExpenditureApi = {
  /** 指定月の有効な予定支出一覧を取得 */
  list: (month: string) =>
    api.get('/planned-expenditures', { params: { month } }),

  /** 予定支出を新規登録 */
  create: (data: CreateSubscriptionData | CreateCalendarExpenditureData) =>
    api.post('/planned-expenditures', data),

  /** 予定支出を更新 */
  update: (id: string, data: Partial<CreateSubscriptionData> & { is_active?: boolean }) =>
    api.patch(`/planned-expenditures/${id}`, data),

  /** 予定支出を削除 */
  delete: (id: string) => api.delete(`/planned-expenditures/${id}`),
};

// ============================================================
// カレンダーイベント API（支出予定連動用・フィルタなし）
// ============================================================
export const calendarEventApi = {
  /** 指定月のカレンダーイベント全件取得 */
  list: (month: string, googleAccessToken: string) =>
    api.get('/calendar-events', {
      params: { month },
      headers: { 'X-Google-Access-Token': googleAccessToken },
    }),
};
