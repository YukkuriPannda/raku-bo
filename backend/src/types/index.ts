export type Category = '食費' | '交通費' | '娯楽' | '衣類' | '医療' | '教育・書籍' | 'カフェ・飲み物' | '家賃・光熱費' | '日用品' | 'その他';
export type PaymentMethod = 'cash' | 'card' | 'qr';
export type TransactionType = 'cash' | 'income_forecast';

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface OcrResult {
  store_name: string;
  date: string;
  items: ReceiptItem[];
  total_amount: number;
  category: Category;
  payment_method: PaymentMethod;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: Category;
  payment_method: PaymentMethod;
  store_name: string | null;
  receipt_url: string | null;
  transacted_at: string;
  created_at: string;
  items?: TransactionItem[];
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  name: string;
  price: number;
  created_at: string;
}

// Hono Variables (c.var に入れる型)
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  GEMINI_API_KEY: string;
  GROQ_API_KEY?: string;
  AI: Ai;
  R2_BUCKET: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

export interface Variables {
  userId: string;
}
