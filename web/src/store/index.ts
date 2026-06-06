import { create } from 'zustand'
import { supabase, signOut as supabaseSignOut, getGoogleAccessToken } from '../lib/auth'
import { transactionApi, pointApi, shiftApi, profileApi } from '../lib/api'
import type {
  User,
  Transaction,
  Point,
  ShiftEvent,
  OcrResult,
  BalanceData,
  CreateTransactionData,
} from '../types'

const CACHE_KEY = 'rakubo_transactions'

const cacheTransactions = (txs: Transaction[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(txs))
  } catch {}
}

const getCachedTransactions = (month: string): Transaction[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const all: Transaction[] = JSON.parse(raw)
    return all
      .filter((t) => t.transacted_at.startsWith(month))
      .sort((a, b) => b.transacted_at.localeCompare(a.transacted_at))
  } catch {
    return []
  }
}

const emptyBalance: BalanceData = {
  expense_total: 0,
  income_forecast: 0,
  points_total_yen: 0,
  remaining: 0,
}

interface AppState {
  user: User | null
  transactions: Transaction[]
  points: Point[]
  shifts: ShiftEvent[]
  balance: BalanceData
  hourlyWage: number
  shiftKeywords: string[]
  isLoading: boolean
  ocrResult: OcrResult | null
  calendarError: string | null

  setUser: (user: User | null) => void
  logout: () => Promise<void>
  fetchTransactions: (month: string) => Promise<void>
  fetchPoints: () => Promise<void>
  fetchShifts: (month: string) => Promise<void>
  fetchProfile: () => Promise<void>
  clearCalendarError: () => void
  calcBalance: () => void
  addTransaction: (data: CreateTransactionData) => Promise<void>
  setOcrResult: (result: OcrResult) => void
  clearOcrResult: () => void
  setHourlyWage: (wage: number) => void
  setShiftKeywords: (keywords: string[]) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  transactions: [],
  points: [],
  shifts: [],
  balance: emptyBalance,
  hourlyWage: 1000,
  shiftKeywords: ['バイト', 'シフト', '出勤', '勤務'],
  isLoading: false,
  ocrResult: null,
  calendarError: null,

  setUser: (user) => set({ user }),

  fetchProfile: async () => {
    try {
      const { data } = await profileApi.get()
      if (data.hourly_wage) set({ hourlyWage: data.hourly_wage })
      if (data.shift_keywords?.length > 0) set({ shiftKeywords: data.shift_keywords })
    } catch (error) {
      console.error('[Store] fetchProfile failed', error)
    }
  },

  logout: async () => {
    await supabaseSignOut()
    localStorage.removeItem(CACHE_KEY)
    set({
      user: null,
      transactions: [],
      points: [],
      shifts: [],
      balance: emptyBalance,
      ocrResult: null,
    })
  },

  fetchTransactions: async (month) => {
    set({ isLoading: true })
    try {
      const transactions = await transactionApi.list(month)
      cacheTransactions(transactions)
      set({ transactions })
    } catch (error) {
      console.warn('[Store] fetchTransactions failed, using cache', error)
      set({ transactions: getCachedTransactions(month) })
    } finally {
      set({ isLoading: false })
      get().calcBalance()
    }
  },

  fetchPoints: async () => {
    try {
      const points = await pointApi.list()
      set({ points })
      get().calcBalance()
    } catch (error) {
      console.error('[Store] fetchPoints failed', error)
    }
  },

  fetchShifts: async (month) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const googleToken = getGoogleAccessToken(session) ?? undefined
    set({ calendarError: null })
    try {
      const rawShifts = await shiftApi.list(month, googleToken)
      const { hourlyWage } = get()
      const shifts = rawShifts.map((s) => ({
        ...s,
        estimated_wage: s.estimated_wage ?? s.duration_hours * hourlyWage,
      }))
      set({ shifts })
      get().calcBalance()
    } catch (error) {
      console.error('[Store] fetchShifts failed', error)
      set({ calendarError: 'Googleカレンダーの取得に失敗しました。アクセス権限を確認してください。' })
    }
  },

  clearCalendarError: () => set({ calendarError: null }),

  calcBalance: () => {
    const { transactions, points, shifts } = get()
    const expense_total = transactions
      .filter((t) => t.type === 'cash' || t.type === 'point')
      .reduce((sum, t) => sum + t.amount, 0)
    const income_forecast = shifts.reduce((sum, s) => sum + s.estimated_wage, 0)
    const points_total_yen = points.reduce((sum, p) => sum + p.amount * p.rate, 0)
    const remaining = income_forecast + points_total_yen - expense_total
    set({ balance: { expense_total, income_forecast, points_total_yen, remaining } })
  },

  addTransaction: async (data) => {
    const transaction = await transactionApi.create(data)
    const { transactions } = get()
    const updated = [transaction, ...transactions]
    cacheTransactions(updated)
    set({ transactions: updated })
    get().calcBalance()
  },

  setOcrResult: (result) => set({ ocrResult: result }),
  clearOcrResult: () => set({ ocrResult: null }),

  setHourlyWage: (wage) => {
    const { shifts } = get()
    const updatedShifts = shifts.map((s) => ({
      ...s,
      estimated_wage: s.duration_hours * wage,
    }))
    set({ hourlyWage: wage, shifts: updatedShifts })
    get().calcBalance()
    profileApi.update({ hourly_wage: wage }).catch((e) =>
      console.error('[Store] setHourlyWage DB保存エラー:', e)
    )
  },

  setShiftKeywords: async (keywords) => {
    set({ shiftKeywords: keywords })
    try {
      await profileApi.update({ shift_keywords: keywords })
    } catch (error) {
      console.error('[Store] setShiftKeywords DB保存エラー:', error)
    }
  },
}))
