import axios from 'axios'
import { supabase } from './auth'
import type { Transaction, ShiftEvent, OcrResult, CreateTransactionData } from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8787',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.response?.status, error.message)
    return Promise.reject(error)
  },
)

export const receiptApi = {
  upload: async (file: File): Promise<{ receipt_id: string; ocr_result: OcrResult }> => {
    const formData = new FormData()
    formData.append('image', file)
    const { data } = await api.post('/receipts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
}

export const transactionApi = {
  list: async (month: string): Promise<Transaction[]> => {
    const { data } = await api.get('/transactions', { params: { month } })
    return data
  },
  create: async (payload: CreateTransactionData): Promise<Transaction> => {
    const { data } = await api.post('/transactions', payload)
    return data
  },
}

export const shiftApi = {
  list: async (month: string, googleAccessToken?: string): Promise<ShiftEvent[]> => {
    const headers: Record<string, string> = {}
    if (googleAccessToken) {
      headers['X-Google-Access-Token'] = googleAccessToken
    }
    const { data } = await api.get('/shifts', { params: { month }, headers })
    return data
  },
}

export const profileApi = {
  get: () => api.get('/profile'),
  update: (data: { hourly_wage?: number; shift_keywords?: string[] }) =>
    api.patch('/profile', data),
}
