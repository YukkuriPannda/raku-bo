import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { CATEGORIES, CATEGORY_EMOJI, PAYMENT_METHODS } from '../types'
import type { Category, PaymentMethod } from '../types'

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

export default function ManualEntry() {
  const navigate = useNavigate()
  const { addTransaction } = useAppStore()

  const [storeName, setStoreName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('食費')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [date, setDate] = useState(todayString)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const parsed = parseInt(amount, 10)
    if (isNaN(parsed) || parsed <= 0) {
      setError('金額を正しく入力してください')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await addTransaction({
        type: 'cash',
        amount: parsed,
        category,
        payment_method: paymentMethod,
        store_name: storeName.trim() || undefined,
        transacted_at: new Date(date).toISOString(),
      })
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Save error:', err)
      setError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 py-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          ←
        </button>
        <h2 className="text-xl font-bold text-white">手動入力</h2>
      </div>

      <div className="space-y-5 flex-1">
        {/* Amount */}
        <div>
          <label className="block text-gray-400 text-sm mb-1.5">
            金額 <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-4 py-3 border border-gray-800 focus-within:border-green-500">
            <span className="text-gray-400 text-lg font-medium">¥</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
              className="flex-1 bg-transparent text-white text-2xl font-bold outline-none"
            />
          </div>
        </div>

        {/* Store name / memo */}
        <div>
          <label className="block text-gray-400 text-sm mb-1.5">店舗名・メモ</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="店舗名またはメモ（任意）"
            className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 border border-gray-800 focus:border-green-500 outline-none"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-gray-400 text-sm mb-1.5">日付</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 border border-gray-800 focus:border-green-500 outline-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-gray-400 text-sm mb-2">カテゴリ</label>
          <div className="grid grid-cols-5 gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`py-2 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-colors ${
                  category === cat
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                <span className="text-lg">{CATEGORY_EMOJI[cat]}</span>
                <span className="text-xs leading-tight text-center">{cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-gray-400 text-sm mb-2">支払方法</label>
          <div className="flex gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.value}
                onClick={() => setPaymentMethod(pm.value)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  paymentMethod === pm.value
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3 text-center">
            {error}
          </div>
        )}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-400 disabled:opacity-50 transition-colors mt-6"
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            保存中...
          </span>
        ) : (
          '保存する'
        )}
      </button>
    </div>
  )
}
