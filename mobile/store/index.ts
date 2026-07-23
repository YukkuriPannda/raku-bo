// ============================================================
// store/index.ts
// Zustand グローバルストア
// アプリ全体の状態を一元管理する
// ============================================================

import { create } from 'zustand';
import { transactionApi, balanceApi, shiftApi, profileApi, plannedExpenditureApi, calendarEventApi, authApi } from '@/lib/api';
import { signOut as authSignOut, loadGoogleRefreshToken, saveGoogleAccessToken } from '@/lib/auth';
import { AuthError, AuthErrorCode, parseAuthError, getAuthErrorMessage } from '@/lib/auth-errors';
import { cacheTransactions, getCachedTransactions, clearCache } from '@/lib/db';
import { saveWidgetBudget, clearWidgetBudget, saveWidgetHeatmap, clearWidgetHeatmap } from '@/lib/widget-bridge';
import type { DailySpend } from '@/lib/widget-bridge';
import type {
  User,
  Transaction,
  ShiftEvent,
  BalanceData,
  CreateTransactionData,
  UpdateTransactionData,
  PlannedExpenditure,
  CalendarEvent,
  CreateSubscriptionData,
  CreateCalendarExpenditureData,
} from '@/types';

// ============================================================
// ストアの型定義
// ============================================================
interface AppState {
  // ---- 状態 ----
  user: User | null;
  transactions: Transaction[];
  shifts: ShiftEvent[];
  plannedExpenditures: PlannedExpenditure[];
  calendarEvents: CalendarEvent[];
  balance: BalanceData;
  hourlyWage: number;        // 時給（円）
  shiftKeywords: string[];
  isLoading: boolean;
  pendingImageBase64: string | null; // 撮影直後の未アップロード画像
  calendarError: string | null;
  heatmapDays: DailySpend[]; // 草グラフ用：直近約63日分の日別支出合計

  // ---- ユーザー ----
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;

  // ---- データ取得 ----
  fetchTransactions: (month: string) => Promise<void>;
  fetchShifts: (month: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchPlannedExpenditures: (month: string) => Promise<void>;
  fetchCalendarEvents: (month: string) => Promise<void>;
  clearCalendarError: () => void;

  // ---- 設定保存 ----
  setShiftKeywords: (keywords: string[]) => Promise<void>;

  // ---- 残高計算 ----
  calcBalance: () => void;
  refreshHeatmapWidget: () => Promise<void>;

  // ---- トランザクション追加・更新・削除 ----
  addTransaction: (data: CreateTransactionData) => Promise<void>;
  updateTransaction: (id: string, data: UpdateTransactionData) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // ---- 予定支出 追加・更新・削除・完了 ----
  addPlannedExpenditure: (data: CreateSubscriptionData | CreateCalendarExpenditureData) => Promise<void>;
  updatePlannedExpenditure: (id: string, data: Partial<CreateSubscriptionData> & { is_active?: boolean }) => Promise<void>;
  deletePlannedExpenditure: (id: string) => Promise<void>;
  completePlannedExpenditure: (id: string) => Promise<void>;

  // ---- 撮影画像 ----
  setPendingImage: (base64: string) => void;
  clearPendingImage: () => void;

  // ---- 設定 ----
  setHourlyWage: (wage: number) => void;
}

// ============================================================
// 残高の初期値
// ============================================================
const initialBalance: BalanceData = {
  expense_total: 0,
  income_forecast: 0,
  planned_total: 0,
  remaining: 0,
};

// ============================================================
// Zustand ストア
// ============================================================
export const useAppStore = create<AppState>((set, get) => ({
  // ---- 初期状態 ----
  user: null,
  transactions: [],
  shifts: [],
  plannedExpenditures: [],
  calendarEvents: [],
  balance: initialBalance,
  hourlyWage: 1_000, // デフォルト時給 1000 円
  shiftKeywords: ['バイト', 'シフト', '出勤', '勤務'],
  isLoading: false,
  pendingImageBase64: null,
  calendarError: null,
  heatmapDays: [],

  // ============================================================
  // ユーザー設定
  // ============================================================
  setUser: (user) => set({ user }),

  logout: async () => {
    await authSignOut();
    await clearCache();
    clearWidgetBudget();
    clearWidgetHeatmap();
    set({
      user: null,
      transactions: [],
      shifts: [],
      plannedExpenditures: [],
      calendarEvents: [],
      balance: initialBalance,
      pendingImageBase64: null,
      heatmapDays: [],
    });
  },

  // ============================================================
  // プロフィール取得（時給・シフトキーワード）
  // ============================================================
  fetchProfile: async () => {
    try {
      const res = await profileApi.get();
      const data = res.data;
      if (data.hourly_wage) set({ hourlyWage: data.hourly_wage });
      if (data.shift_keywords?.length > 0) set({ shiftKeywords: data.shift_keywords });
    } catch (error) {
      console.error('[fetchProfile] エラー:', error);
    }
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
  // シフト一覧取得
  // ============================================================
  fetchShifts: async (month) => {
    const { user, hourlyWage } = get();
    if (!user) return;

    set({ isLoading: true, calendarError: null });

    const doFetch = async (token: string) => shiftApi.list(month, token);

    try {
      let token = user.googleAccessToken;
      let res;
      try {
        res = await doFetch(token);
      } catch (firstErr: unknown) {
        const status = (firstErr as { response?: { status?: number } }).response?.status;
        if (status === 401) {
          // トークン期限切れ → リフレッシュして1回リトライ
          const refreshToken = await loadGoogleRefreshToken();
          if (!refreshToken) throw new AuthError(AuthErrorCode.GOOGLE_REFRESH_TOKEN_MISSING);
          const refreshRes = await authApi.refreshGoogleToken(refreshToken);
          token = refreshRes.data.access_token;
          await saveGoogleAccessToken(token);
          set({ user: { ...user, googleAccessToken: token } });
          res = await doFetch(token);
        } else {
          throw firstErr;
        }
      }
      const shifts: ShiftEvent[] = res.data.map((s: ShiftEvent) => ({
        ...s,
        estimated_wage: s.estimated_wage ?? Math.round(s.duration_hours * hourlyWage),
      }));
      set({ shifts });
    } catch (error) {
      const authErr = parseAuthError(error);
      console.error('[fetchShifts] エラー:', authErr.code, authErr.detail ?? authErr.message);
      set({ calendarError: `${getAuthErrorMessage(authErr.code)}\n（エラーコード: ${authErr.code}）` });
    } finally {
      set({ isLoading: false });
      get().calcBalance();
    }
  },

  clearCalendarError: () => set({ calendarError: null }),

  // ============================================================
  // 予定支出一覧取得
  // ============================================================
  fetchPlannedExpenditures: async (month) => {
    set({ isLoading: true });
    try {
      const res = await plannedExpenditureApi.list(month);
      set({ plannedExpenditures: res.data });
    } catch (error) {
      console.error('[fetchPlannedExpenditures] エラー:', error);
    } finally {
      set({ isLoading: false });
      get().calcBalance();
    }
  },

  // ============================================================
  // カレンダーイベント一覧取得（支出予定連動用）
  // ============================================================
  fetchCalendarEvents: async (month) => {
    const { user } = get();
    if (!user) return;
    try {
      let token = user.googleAccessToken;
      let res;
      try {
        res = await calendarEventApi.list(month, token);
      } catch (firstErr: unknown) {
        const status = (firstErr as { response?: { status?: number } }).response?.status;
        if (status === 401) {
          const refreshToken = await loadGoogleRefreshToken();
          if (!refreshToken) throw new AuthError(AuthErrorCode.GOOGLE_REFRESH_TOKEN_MISSING);
          const refreshRes = await authApi.refreshGoogleToken(refreshToken);
          token = refreshRes.data.access_token;
          await saveGoogleAccessToken(token);
          set({ user: { ...user, googleAccessToken: token } });
          res = await calendarEventApi.list(month, token);
        } else {
          throw firstErr;
        }
      }
      set({ calendarEvents: res.data });
    } catch (error) {
      const authErr = parseAuthError(error);
      console.error('[fetchCalendarEvents] エラー:', authErr.code, authErr.detail ?? authErr.message);
      set({
        calendarEvents: [],
        calendarError: `${getAuthErrorMessage(authErr.code)}\n(エラーコード: ${authErr.code})`,
      });
    }
  },

  // ============================================================
  // 残高計算
  // 残り = 月収見込み - 支出合計 - 予定支出合計
  // ============================================================
  calcBalance: () => {
    const { transactions, shifts, plannedExpenditures } = get();

    const expense_total = transactions
      .filter((t) => t.type === 'cash')
      .reduce((sum, t) => sum + t.amount, 0);

    const income_forecast = shifts.reduce((sum, s) => sum + s.estimated_wage, 0);

    const planned_total = plannedExpenditures.reduce((sum, p) => sum + p.amount, 0);

    const remaining = income_forecast - expense_total - planned_total;

    const balance = { expense_total, income_forecast, planned_total, remaining };
    set({ balance });

    // ホーム画面ウィジェットへ反映（ネットワーク非依存のキャッシュ書き込み）
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const recentTransactions = transactions
      .filter((t) => t.type === 'cash')
      .slice()
      .sort((a, b) => b.transacted_at.localeCompare(a.transacted_at))
      .slice(0, 2)
      .map((t) => ({ label: t.store_name ?? t.category, amount: t.amount }));

    // 直近の支出予定（サブスクを除く、カレンダー連動のみ・日付が近い順）
    const todayStr = now.toISOString().slice(0, 10);
    const upcomingPlanned = plannedExpenditures
      .filter((p) => p.entry_type === 'calendar' && !!p.event_date && p.event_date >= todayStr)
      .slice()
      .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))
      .slice(0, 2)
      .map((p) => ({ label: p.calendar_event_title ?? p.category, amount: p.amount }));

    saveWidgetBudget(balance, month, recentTransactions, upcomingPlanned);

    // 草グラフウィジェット用の日別支出（直近約2ヶ月分）を非同期で更新
    get().refreshHeatmapWidget();
  },

  // ============================================================
  // 草グラフウィジェット用: 当月 + 前月の取引を取得し、直近63日分を日別集計する
  // （calcBalance が持つ transactions は現在表示中の月のみのため、
  //   前月分だけ追加で取得してマージする）
  // ============================================================
  refreshHeatmapWidget: async () => {
    const { transactions } = get();
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    try {
      const prevRes = await transactionApi.list(prevMonth);
      const prevTransactions: Transaction[] = prevRes.data ?? [];

      const dailyTotals = new Map<string, number>();
      [...transactions, ...prevTransactions]
        .filter((t) => t.type === 'cash')
        .forEach((t) => {
          const d = new Date(t.transacted_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + t.amount);
        });

      const ROLLING_DAYS = 63; // 約9週間（GitHubの草グラフ風、9〜10列）
      const heatmapDays = Array.from({ length: ROLLING_DAYS }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (ROLLING_DAYS - 1 - i));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { date: key, total: dailyTotals.get(key) ?? 0 };
      });

      set({ heatmapDays });
      saveWidgetHeatmap(heatmapDays);
    } catch (error) {
      console.error('[refreshHeatmapWidget] エラー:', error);
    }
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
  // トランザクション更新
  // ============================================================
  updateTransaction: async (id, data) => {
    const res = await transactionApi.update(id, data);
    const updated: Transaction = res.data;
    set((state) => ({
      transactions: state.transactions.map((t) => t.id === id ? updated : t),
    }));
    get().calcBalance();
  },

  // ============================================================
  // トランザクション削除
  // ============================================================
  deleteTransaction: async (id) => {
    try {
      await transactionApi.delete(id);
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== id),
      }));
      get().calcBalance();
    } catch (error) {
      console.error('[deleteTransaction] エラー:', error);
      throw error;
    }
  },

  // ============================================================
  // 予定支出 追加・更新・削除
  // ============================================================
  addPlannedExpenditure: async (data) => {
    set({ isLoading: true });
    try {
      const res = await plannedExpenditureApi.create(data);
      const newItem: PlannedExpenditure = res.data;
      set((state) => ({
        plannedExpenditures: [newItem, ...state.plannedExpenditures],
      }));
      get().calcBalance();
    } catch (error) {
      console.error('[addPlannedExpenditure] エラー:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updatePlannedExpenditure: async (id, data) => {
    const res = await plannedExpenditureApi.update(id, data);
    const updated: PlannedExpenditure = res.data;
    set((state) => ({
      plannedExpenditures: state.plannedExpenditures.map((p) => p.id === id ? updated : p),
    }));
    get().calcBalance();
  },

  deletePlannedExpenditure: async (id) => {
    try {
      await plannedExpenditureApi.delete(id);
      set((state) => ({
        plannedExpenditures: state.plannedExpenditures.filter((p) => p.id !== id),
      }));
      get().calcBalance();
    } catch (error) {
      console.error('[deletePlannedExpenditure] エラー:', error);
      throw error;
    }
  },

  // ============================================================
  // 予定支出の完了（カレンダー連動型のみ）
  // 支出履歴（transactions）に1件追加し、予定支出からは除去する
  // ============================================================
  completePlannedExpenditure: async (id) => {
    try {
      const res = await plannedExpenditureApi.complete(id);
      const newTx: Transaction = res.data;
      set((state) => ({
        transactions: [newTx, ...state.transactions],
        plannedExpenditures: state.plannedExpenditures.filter((p) => p.id !== id),
      }));
      await cacheTransactions([newTx]);
      get().calcBalance();
    } catch (error) {
      console.error('[completePlannedExpenditure] エラー:', error);
      throw error;
    }
  },

  // ============================================================
  // OCR 結果の中間状態管理
  // ============================================================
  setPendingImage: (base64) => set({ pendingImageBase64: base64 }),
  clearPendingImage: () => set({ pendingImageBase64: null }),

  // ============================================================
  // 時給設定（DB保存付き）
  // ============================================================
  setHourlyWage: (wage) => {
    set({ hourlyWage: wage });
    // 時給変更後にシフトの見込み給与を再計算
    const { shifts } = get();
    const updatedShifts = shifts.map((s) => ({
      ...s,
      estimated_wage: Math.round(s.duration_hours * wage),
    }));
    set({ shifts: updatedShifts });
    get().calcBalance();
    // DBに非同期で保存（失敗してもUIは更新済み）
    profileApi.update({ hourly_wage: wage }).catch((e) =>
      console.error('[setHourlyWage] DB保存エラー:', e)
    );
  },

  // ============================================================
  // シフトキーワード設定（DB保存付き）
  // ============================================================
  setShiftKeywords: async (keywords) => {
    set({ shiftKeywords: keywords });
    try {
      await profileApi.update({ shift_keywords: keywords });
    } catch (error) {
      console.error('[setShiftKeywords] DB保存エラー:', error);
    }
  },
}));
