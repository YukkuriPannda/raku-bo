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
  | 'その他'

export const CATEGORY_EMOJI: Record<Category, string> = {
  食費: '🍚',
  交通費: '🚃',
  娯楽: '🎮',
  衣類: '👕',
  医療: '💊',
  '教育・書籍': '📚',
  'カフェ・飲み物': '☕',
  '家賃・光熱費': '🏠',
  日用品: '🧴',
  その他: '📦',
}

export const CATEGORIES: Category[] = [
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
]

export type PaymentMethod = 'cash' | 'card' | 'qr'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'card', label: 'カード' },
  { value: 'qr', label: 'QR' },
]

export type TransactionType = 'cash' | 'point' | 'income_forecast'

export interface OcrResult {
  store_name: string
  date: string
  items: { name: string; price: number }[]
  total_amount: number
  category: Category
  payment_method: PaymentMethod
  points_earned: number | null
}

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  category: Category
  payment_method: PaymentMethod
  store_name: string | null
  receipt_url: string | null
  points_earned: number | null
  transacted_at: string
  created_at: string
}

export interface Point {
  id: string
  name: string
  amount: number
  rate: number
}

export interface ShiftEvent {
  id: string
  title: string
  start: string
  end: string
  duration_hours: number
  estimated_wage: number
}

export interface User {
  id: string
  email: string
  googleAccessToken: string
}

export interface BalanceData {
  expense_total: number
  income_forecast: number
  points_total_yen: number
  remaining: number
}

export interface CreateTransactionData {
  type: TransactionType
  amount: number
  category: Category
  payment_method: PaymentMethod
  store_name?: string
  receipt_url?: string
  points_earned?: number
  transacted_at: string
}
