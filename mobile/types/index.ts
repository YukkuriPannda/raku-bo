// ============================================================
// types/index.ts
// バックエンドと共通の型定義
// ============================================================

/** カテゴリ種別 */
export type Category =
  | '食費'
  | '交通費'
  | '娯楽'
  | '衣類'
  | '医療'
  | '教育・書籍'
  | 'カフェ・飲み物'
  | '家賃・光熱費'
  | '日用品'
  | 'その他';

/** 支払い方法 */
export type PaymentMethod = 'cash' | 'card' | 'qr';

/** トランザクション種別 */
export type TransactionType = 'cash' | 'point' | 'income_forecast';

/** カテゴリに対応する絵文字マップ */
export const CATEGORY_EMOJI: Record<Category, string> = {
  '食費': '🍚',
  '交通費': '🚃',
  '娯楽': '🎮',
  '衣類': '👕',
  '医療': '💊',
  '教育・書籍': '📚',
  'カフェ・飲み物': '☕',
  '家賃・光熱費': '🏠',
  '日用品': '📦',
  'その他': '💸',
};

/** すべてのカテゴリ一覧（UI選択に使用） */
export const ALL_CATEGORIES: Category[] = [
  '食費',
  '交通費',
  '娯楽',
  '衣類',
  '医療',
  '教育・書籍',
  'カフェ・飲み物',
  '家賃・光熱費',
  '日用品',
  'その他',
];

/** OCR解析結果 */
export interface OcrResult {
  store_name: string;
  date: string;
  items: { name: string; price: number }[];
  total_amount: number;
  category: Category;
  payment_method: PaymentMethod;
  points_earned: number | null;
}

/** 支出・収入トランザクション */
export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: Category;
  payment_method: PaymentMethod;
  store_name: string | null;
  receipt_url: string | null;
  points_earned: number | null;
  transacted_at: string;
  created_at: string;
}

/** ポイント情報 */
export interface Point {
  id: string;
  name: string;
  amount: number;
  rate: number; // 1ポイント = rate 円
}

/** シフトイベント（Google Calendar から取得） */
export interface ShiftEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  duration_hours: number;
  estimated_wage: number; // 時給 × 勤務時間
}

/** 残り使える額の内訳データ */
export interface BalanceData {
  expense_total: number;       // 今月支出合計
  income_forecast: number;     // 月収見込み（シフトから計算）
  points_total_yen: number;    // ポイント資産合計（円換算）
  remaining: number;           // 残り使える額
}

/** ログインユーザー情報 */
export interface User {
  id: string;
  email: string;
  googleAccessToken: string;
}

/** 新規トランザクション登録用データ */
export interface CreateTransactionData {
  type: TransactionType;
  amount: number;
  category: Category;
  payment_method: PaymentMethod;
  store_name?: string;
  receipt_url?: string;
  points_earned?: number;
  transacted_at: string;
}
