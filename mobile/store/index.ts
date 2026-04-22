// ============================================================
// store/index.ts
// Zustand グローバルストア
// アプリ全体の状態を一元管理する
// ============================================================

import { create } from 'zustand';
import { transactionApi, balanceApi, shiftApi, pointApi } from '@/lib/api';
import { signOut as authSignOut } from '@/lib/auth';
import { cacheTransactions, getCachedTransactions, clearCache } from '@/lib/db';
import type {
  User,
  Transaction,
  Point,
  ShiftEvent,
  BalanceData,
  OcrResult,
  CreateTransactionData,
} from '@/types';

// ============================================================
// ストアの型定義
// ============================================================
interface AppState {
  // ---- 状態 ----
  user: User | null;
  transactions: Transaction[];
  points: Point[];
  shifts: ShiftEvent[];
  balance: BalanceData;
  hourlyWage: number;        // 時給（円）
  isLoading: boolean;
  ocrResult: OcrResult | null; // confirm 画面に渡す中間状態

  // ---- ユーザー ----
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;

  // ---- データ取得 ----
  fetchTransactions: (month: string) => Promise<void>;
  fetchPoints: () => Promise<void>;
  fetchShifts: (month: string) => Promise<void>;

  // ---- 残高計算 ----
  calcBalance: () => void;

  // ---- トランザクション追加 ----
  addTransaction: (data: CreateTransactionData) => Promise<void>;

  // ---- OCR 結果 ----
  setOcrResult: (result: OcrResult) => void;
  clearOcrResult: () => void;

  // ---- 設定 ----
  setHourlyWage: (wage: number) => void;
}

// ============================================================
// 残高の初期値
// ============================================================
const initialBalance: BalanceData = {
  expense_total: 0,
  income_forecast: 0,
  points_total_yen: 0,
  remaining: 0,
};

// ============================================================
// Zustand ストア
// ============================================================
export const useAppStore = create<AppState>((set, get) => ({
  // ---- 初期状態 ----
  user: null,
  transactions: [],
  points: [],
  shifts: [],
  balance: initialBalance,
  hourlyWage: 1_000, // デフォルト時給 1000 円
  isLoading: false,
  ocrResult: null,

  // ============================================================
  // ユーザー設定
  // ============================================================
  setUser: (user) => set({ user }),

  logout: async () => {
    await authSignOut();
    await clearCache();
    set({
      user: null,
      transactions: [],
      points: [],
      shifts: [],
      balance: initialBalance,
      ocrResult: null,
    });
  },

  // ============================================================
  // トランザクション取得
  // ネットワークエラー時はキャッシュから返す
  // ============================================================
  fetchTransactions: async (month) => {
    set({ isLoading: true });
    try {
      const res = await transactionApi.list(month);
      const data: Transaction[] = res.data;
      set({ transactions: data });

      // ローカルキャッシュに保存
      await cacheTransactions(data);
    } catch (error) {
      console.warn('[fetchTransactions] API エラー、キャッシュから取得:', error);
      // オフライン時はキャッシュから読み込む
      const cached = await getCachedTransactions(month);
      set({ transactions: cached });
    } finally {
      set({ isLoading: false });
      get().calcBalance();
    }
  },

  // ============================================================
  // ポイント一覧取得
  // ============================================================
  fetchPoints: async () => {
    set({ isLoading: true });
    try {
      const res = await pointApi.list();
      set({ points: res.data });
    } catch (error) {
      console.error('[fetchPoints] エラー:', error);
    } finally {
      set({ isLoading: false });
      get().calcBalance();
    }
  },

  // ============================================================
  // シフト一覧取得
  // ============================================================
  fetchShifts: async (month) => {
    const { user, hourlyWage } = get();
    if (!user) return;

    set({ isLoading: true });
    try {
      const res = await shiftApi.list(month, user.googleAccessToken);
      // estimated_wage が未設定の場合は時給 × duration_hours で補完
      const shifts: ShiftEvent[] = res.data.map((s: ShiftEvent) => ({
        ...s,
        estimated_wage: s.estimated_wage ?? s.duration_hours * hourlyWage,
      }));
      set({ shifts });
    } catch (error) {
      console.error('[fetchShifts] エラー:', error);
    } finally {
      set({ isLoading: false });
      get().calcBalance();
    }
  },

  // ============================================================
  // 残高計算
  // 月収見込み = シフトの estimated_wage 合計
  // 残り = 月収見込み + ポイント資産（円換算）- 支出合計
  // ============================================================
  calcBalance: () => {
    const { transactions, points, shifts } = get();

    const expense_total = transactions
      .filter((t) => t.type === 'cash' || t.type === 'point')
      .reduce((sum, t) => sum + t.amount, 0);

    const income_forecast = shifts.reduce((sum, s) => sum + s.estimated_wage, 0);

    const points_total_yen = points.reduce(
      (sum, p) => sum + Math.floor(p.amount * p.rate),
      0
    );

    const remaining = income_forecast + points_total_yen - expense_total;

    set({
      balance: {
        expense_total,
        income_forecast,
        points_total_yen,
        remaining,
      },
    });
  },

  // ============================================================
  // トランザクション追加
  // API POST 後にローカルステートも更新する
  // ============================================================
  addTransaction: async (data) => {
    set({ isLoading: true });
    try {
      const res = await transactionApi.create(data);
      const newTx: Transaction = res.data;

      // ローカルステートの先頭に追加
      set((state) => ({
        transactions: [newTx, ...state.transactions],
      }));

      // キャッシュにも保存
      await cacheTransactions([newTx]);

      // 残高を再計算
      get().calcBalance();
    } catch (error) {
      console.error('[addTransaction] エラー:', error);
      throw error; // 呼び出し元でハンドリングする
    } finally {
      set({ isLoading: false });
    }
  },

  // ============================================================
  // OCR 結果の中間状態管理
  // ============================================================
  setOcrResult: (result) => set({ ocrResult: result }),
  clearOcrResult: () => set({ ocrResult: null }),

  // ============================================================
  // 時給設定
  // ============================================================
  setHourlyWage: (wage) => {
    set({ hourlyWage: wage });
    // 時給変更後にシフトの見込み給与を再計算
    const { shifts } = get();
    const updatedShifts = shifts.map((s) => ({
      ...s,
      estimated_wage: s.duration_hours * wage,
    }));
    set({ shifts: updatedShifts });
    get().calcBalance();
  },
}));
