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
export type TransactionType = 'cash' | 'income_forecast';

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
}

/** トランザクションに紐づく商品アイテム */
export interface TransactionItem {
  id: string;
  transaction_id: string;
  name: string;
  price: number;
  created_at: string;
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
  /** 建て替え払い（他人の分を立て替えた支出）。残額計算からは常に除外する */
  is_advance: boolean;
  /** 建て替えの返済日時。null のあいだは未回収 */
  settled_at: string | null;
  transacted_at: string;
  created_at: string;
  items?: TransactionItem[];
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
  expense_total: number;           // 今月支出合計（建て替えを含む総額）
  advance_total: number;           // うち建て替え分の合計
  advance_unsettled_total: number; // うち未回収（返済されていない）建て替えの合計
  net_expense_total: number;       // 実質の支出（expense_total - advance_total）
  income_forecast: number;         // 月収見込み（シフトから計算）
  planned_total: number;           // 予定された支出合計
  remaining: number;               // 残り使える額
}

/** 予定された支出の種別 */
export type PlannedEntryType = 'subscription' | 'calendar';

/** サブスクの請求サイクル */
export type BillingCycle = 'monthly' | 'yearly';

/** 予定された支出 */
export interface PlannedExpenditure {
  id: string;
  user_id: string;
  entry_type: PlannedEntryType;
  amount: number;
  category: Category;
  payment_method: PaymentMethod;
  memo: string | null;
  // サブスク用
  service_name: string | null;
  billing_cycle: BillingCycle | null;
  billing_day: number | null;
  billing_month: number | null;
  is_active: boolean;
  // カレンダー連動用
  calendar_event_id: string | null;
  calendar_event_title: string | null;
  event_date: string | null; // "YYYY-MM-DD"
  created_at: string;
  updated_at: string;
}

/** Googleカレンダーのイベント（支出予定連動用） */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  date: string; // "YYYY-MM-DD"
}

/** サブスク登録データ */
export interface CreateSubscriptionData {
  entry_type: 'subscription';
  service_name: string;
  amount: number;
  category: Category;
  payment_method: PaymentMethod;
  billing_cycle: BillingCycle;
  billing_day: number;
  billing_month?: number;
  memo?: string;
}

/** カレンダー連動登録データ */
export interface CreateCalendarExpenditureData {
  entry_type: 'calendar';
  calendar_event_id: string;
  calendar_event_title: string;
  event_date: string;
  amount: number;
  category: Category;
  payment_method: PaymentMethod;
  memo?: string;
}

/** ログインユーザー情報 */
export interface User {
  id: string;
  email: string;
  googleAccessToken: string;
}

/** トランザクション更新用データ */
export interface UpdateTransactionData {
  amount: number;
  category: Category;
  payment_method: PaymentMethod;
  store_name?: string;
  transacted_at: string;
  is_advance?: boolean;
  items?: { name: string; price: number }[];
}

/** 新規トランザクション登録用データ */
export interface CreateTransactionData {
  type: TransactionType;
  amount: number;
  category: Category;
  payment_method: PaymentMethod;
  store_name?: string;
  receipt_url?: string;
  transacted_at: string;
  is_advance?: boolean;
  items?: { name: string; price: number }[];
}
