// ============================================================
// lib/api.ts
// axios インスタンス + API クライアント関数
// ============================================================

import axios from 'axios';
import { supabase } from './auth';
import { API_BASE_URL } from '@/constants/api';
import type {
  CreateTransactionData,
  UpdateTransactionData,
  CreateSubscriptionData,
  CreateCalendarExpenditureData,
  Transaction,
} from '@/types';

/** 通信のタイムアウト。axios と、fetch を直接使う経路で同じ値を使う */
const REQUEST_TIMEOUT_MS = 30_000;

// ============================================================
// axios インスタンス
// ============================================================
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
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
    console.error(
      '[API Error]',
      error.response?.status,
      error.response?.data,
      'authCode:', error.response?.data?.code,
      'code:', error.code,
      'msg:', error.message,
    );
    return Promise.reject(error);
  }
);

// ============================================================
// 認証 API
// ============================================================
export const authApi = {
  /** Google アクセストークンをリフレッシュトークンで更新 */
  refreshGoogleToken: (refreshToken: string) =>
    api.post<{ access_token: string }>('/auth/refresh-google-token', { refresh_token: refreshToken }),
};

// ============================================================
// レシート API（base64 JSON 送信 - Expo Go の file:// URI 制限を回避）
// axios を通さず fetch を直接使うため、ベースURLは共通の定数を参照する
// ============================================================
export const receiptApi = {
  upload: async (base64: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    // セッションが無いまま空の Bearer を送ると、原因のわかりにくい 401 になる。
    // 呼び出し側が扱える形で先に落とす。
    if (!token) {
      throw Object.assign(new Error('ログインが必要です'), { response: { status: 401, data: { code: 'AUTH_NO_TOKEN' } } });
    }

    // axios 経由（timeout 30秒）ではなく fetch を直接使っているため、
    // タイムアウトを自前で用意する。無いと通信が固まったまま復帰しない。
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/receipts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64 }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw Object.assign(new Error('アップロードがタイムアウトしました'), { code: 'ECONNABORTED' });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

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

  /** 建て替えの返済状態を切り替える（他のフィールドや明細には触れない） */
  settle: (id: string, settled: boolean) =>
    api.patch<Transaction>(`/transactions/${id}`, {
      settled_at: settled ? new Date().toISOString() : null,
    }),

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

  /** カレンダー連動型の予定支出を完了させ、支出履歴に移す */
  complete: (id: string) => api.post<Transaction>(`/planned-expenditures/${id}/complete`),
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
