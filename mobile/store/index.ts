// ============================================================
// store/index.ts
// Zustand グローバルストア
// アプリ全体の状態を一元管理する
// ============================================================

import { create } from 'zustand';
import { transactionApi, balanceApi, shiftApi, profileApi, plannedExpenditureApi, calendarEventApi, authApi } from '@/lib/api';
import { signOut as authSignOut, loadGoogleRefreshToken, saveGoogleAccessToken } from '@/lib/auth';
import { AuthError, AuthErrorCode, parseAuthError, getAuthErrorMessage, describeError } from '@/lib/auth-errors';
import { cacheTransactions, getCachedTransactions, clearCache } from '@/lib/db';
import { saveWidgetBudget, clearWidgetBudget, saveWidgetHeatmap, clearWidgetHeatmap } from '@/lib/widget-bridge';
import { showReceiptQuickCaptureNotification, clearReceiptQuickCaptureNotification } from '@/lib/notifications';
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
// ローカルキャッシュへの保存は「補助」であって、処理の成否ではない。
//
// API が成功してステートも更新できているのに、キャッシュ書き込みの失敗で
// 呼び出し全体を失敗させてはいけない。実際に次の不具合が起きていた:
// SQLite のトランザクション競合で cacheTransactions が投げ、
// fetchTransactions が catch に落ちて、取得済みの正しいデータを
// キャッシュの内容で上書きしていた（表示が古い値に戻る）。
// 競合自体は lib/db.ts 側で直したが、保存の失敗が本処理を壊さないよう
// 呼び出し口でも切り分けておく。
// ============================================================
async function cacheTransactionsQuietly(transactions: Transaction[], where: string): Promise<void> {
  try {
    await cacheTransactions(transactions);
  } catch (error) {
    console.warn(`[${where}] キャッシュ保存に失敗（表示と同期は継続）:`, describeError(error));
  }
}

// ============================================================
// Googleカレンダー呼び出しの失敗が「Googleアクセストークンを取り直せば
// 解決する」種類のものかを判定する。
//   401 + AUTH_GOOGLE_API_ERROR    … アクセストークンの期限切れ（1時間）
//   400 + AUTH_GOOGLE_TOKEN_MISSING … 端末にトークンが無い状態で送信した
// 同じ401でもSupabaseセッション切れ（AUTH_SUPABASE_VERIFY_FAILED等）が
// 原因のことがあり、その場合はGoogleトークンを更新しても解決しないため
// ステータスコードだけでなくバックエンドが返すエラーコードも見る。
// ============================================================
function isGoogleTokenRefreshable(err: unknown): boolean {
  const response = (err as { response?: { status?: number; data?: { code?: string } } }).response;
  const code = response?.data?.code;
  return (
    (response?.status === 401 && code === AuthErrorCode.GOOGLE_API_ERROR) ||
    (response?.status === 400 && code === AuthErrorCode.GOOGLE_TOKEN_MISSING)
  );
}

// ============================================================
// Googleアクセストークンを使うAPI呼び出しの共通ラッパー。
// トークンが空、または期限切れだった場合はリフレッシュトークンで
// 1回だけ取り直して再試行する。取り直したトークンはSecureStoreと
// ストアの両方へ反映し、以降の呼び出しでも使えるようにする。
// リフレッシュトークン自体が無い場合だけ再ログインが必要になる。
// ============================================================
async function callWithGoogleToken<T>(
  user: User,
  onTokenRefreshed: (token: string) => void,
  request: (token: string) => Promise<T>,
): Promise<T> {
  const refresh = async (): Promise<string> => {
    const refreshToken = await loadGoogleRefreshToken();
    if (!refreshToken) throw new AuthError(AuthErrorCode.GOOGLE_REFRESH_TOKEN_MISSING);
    const res = await authApi.refreshGoogleToken(refreshToken);
    const token = res.data.access_token;
    await saveGoogleAccessToken(token);
    onTokenRefreshed(token);
    return token;
  };

  // 再起動直後などトークンが空のまま叩くと400になるため、先に取り直す
  if (!user.googleAccessToken) {
    return request(await refresh());
  }

  try {
    return await request(user.googleAccessToken);
  } catch (err) {
    if (!isGoogleTokenRefreshable(err)) throw err;
    return request(await refresh());
  }
}

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
  settleAdvance: (id: string, settled: boolean) => Promise<void>;

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
  advance_total: 0,
  advance_unsettled_total: 0,
  net_expense_total: 0,
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
    clearReceiptQuickCaptureNotification();
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
      console.error('[fetchProfile] エラー:', describeError(error));
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

      // 保存の失敗で取得結果を捨ててはいけない（cacheTransactionsQuietly のコメント参照）
      await cacheTransactionsQuietly(data, 'fetchTransactions');
    } catch (error) {
      console.warn('[fetchTransactions] API エラー、キャッシュから取得:', describeError(error));
      // オフライン時はキャッシュから読み込む。
      // 他アカウントのキャッシュを混ぜないよう、必ず現在のユーザーIDで絞る
      const cached = await getCachedTransactions(month, get().user?.id ?? null);
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

    try {
      // Supabaseセッション切れなど、Google側の問題ではないエラーは
      // ラッパー内でリフレッシュせずそのまま投げられる
      const res = await callWithGoogleToken(
        user,
        (token) => set({ user: { ...user, googleAccessToken: token } }),
        (token) => shiftApi.list(month, token),
      );
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
      console.error('[fetchPlannedExpenditures] エラー:', describeError(error));
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
      const res = await callWithGoogleToken(
        user,
        (token) => set({ user: { ...user, googleAccessToken: token } }),
        (token) => calendarEventApi.list(month, token),
      );
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

    const cashTransactions = transactions.filter((t) => t.type === 'cash');

    const expense_total = cashTransactions.reduce((sum, t) => sum + t.amount, 0);

    // 建て替えは自分の支出ではないため、返済済みかどうかに関係なく実質支出から除く。
    // 未回収分は「返してもらい忘れ」を防ぐための表示用に別途集計する。
    const advanceTransactions = cashTransactions.filter((t) => t.is_advance);
    const advance_total = advanceTransactions.reduce((sum, t) => sum + t.amount, 0);
    const advance_unsettled_total = advanceTransactions
      .filter((t) => !t.settled_at)
      .reduce((sum, t) => sum + t.amount, 0);
    const net_expense_total = expense_total - advance_total;

    const income_forecast = shifts.reduce((sum, s) => sum + s.estimated_wage, 0);

    const planned_total = plannedExpenditures.reduce((sum, p) => sum + p.amount, 0);

    const remaining = income_forecast - net_expense_total - planned_total;

    const balance = {
      expense_total,
      advance_total,
      advance_unsettled_total,
      net_expense_total,
      income_forecast,
      planned_total,
      remaining,
    };
    set({ balance });

    // ホーム画面ウィジェットへ反映（ネットワーク非依存のキャッシュ書き込み）
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const recentTransactions = transactions
      .filter((t) => t.type === 'cash' && !t.is_advance)
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
    showReceiptQuickCaptureNotification(remaining);

    // 草グラフウィジェット用の日別支出（直近約2ヶ月分）を非同期で更新
    get().refreshHeatmapWidget();
  },

  // ============================================================
  // 草グラフウィジェット用: 表示に必要な過去分の取引を取得し、日別集計する
  // （calcBalance が持つ transactions は現在表示中の月のみのため、
  //   不足する過去月だけ追加で取得してマージする）
  // ホーム画面カードは直近63日分、Androidウィジェットは7行×15列固定で
  // 表示するため直近105日分が必要。ウィジェット側の日数だけ多く取得する。
  // ============================================================
  refreshHeatmapWidget: async () => {
    const { transactions } = get();
    const now = new Date();

    const ROLLING_DAYS = 63; // ホーム画面カード用（約9週間）
    const WIDGET_ROLLING_DAYS = 15 * 7; // Androidウィジェット用（7行×15列固定）

    // WIDGET_ROLLING_DAYS 分を賄うのに必要な過去月（当月除く）を求める
    const earliestDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WIDGET_ROLLING_DAYS - 1));
    const earliestMonthStart = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
    const monthsNeeded: string[] = [];
    const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor > earliestMonthStart) {
      cursor.setMonth(cursor.getMonth() - 1);
      monthsNeeded.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    }

    try {
      const pastResults = await Promise.all(monthsNeeded.map((m) => transactionApi.list(m)));
      const pastTransactions: Transaction[] = pastResults.flatMap((r) => r.data ?? []);

      const dailyTotals = new Map<string, number>();
      // 建て替えは自分の支出ではないため草グラフにも積まない（残額計算と定義を揃える）
      [...transactions, ...pastTransactions]
        .filter((t) => t.type === 'cash' && !t.is_advance)
        .forEach((t) => {
          const d = new Date(t.transacted_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + t.amount);
        });

      const buildDays = (rollingDays: number): DailySpend[] =>
        Array.from({ length: rollingDays }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (rollingDays - 1 - i));
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return { date: key, total: dailyTotals.get(key) ?? 0 };
        });

      const heatmapDays = buildDays(ROLLING_DAYS);
      set({ heatmapDays });
      saveWidgetHeatmap(buildDays(WIDGET_ROLLING_DAYS));
    } catch (error) {
      console.error('[refreshHeatmapWidget] エラー:', describeError(error));
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
      await cacheTransactionsQuietly([newTx], 'addTransaction');

      // 残高を再計算
      get().calcBalance();
    } catch (error) {
      console.error('[addTransaction] エラー:', describeError(error));
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
      console.error('[deleteTransaction] エラー:', describeError(error));
      throw error;
    }
  },

  // ============================================================
  // 建て替えの返済状態を切り替える
  // 金額や明細には触れず settled_at だけを更新する
  // ============================================================
  settleAdvance: async (id, settled) => {
    try {
      const res = await transactionApi.settle(id, settled);
      const updated: Transaction = res.data;
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...updated } : t)),
      }));
      await cacheTransactionsQuietly([updated], 'settleAdvance');
      get().calcBalance();
    } catch (error) {
      console.error('[settleAdvance] エラー:', describeError(error));
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
      console.error('[addPlannedExpenditure] エラー:', describeError(error));
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
      console.error('[deletePlannedExpenditure] エラー:', describeError(error));
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
      await cacheTransactionsQuietly([newTx], 'completePlannedExpenditure');
      get().calcBalance();
    } catch (error) {
      console.error('[completePlannedExpenditure] エラー:', describeError(error));
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
      console.error('[setHourlyWage] DB保存エラー:', describeError(e))
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
      console.error('[setShiftKeywords] DB保存エラー:', describeError(error));
    }
  },
}));
