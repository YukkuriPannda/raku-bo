import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { CATEGORIES, CATEGORY_EMOJI, PAYMENT_METHODS } from '../types'
import type { Category, PaymentMethod } from '../types'

export default function Confirm() {
  const navigate = useNavigate()
  const { ocrResult, addTransaction, clearOcrResult } = useAppStore()

  const [storeName, setStoreName] = useState(ocrResult?.store_name ?? '')
  const [amount, setAmount] = useState(String(ocrResult?.total_amount ?? ''))
  const [category, setCategory] = useState<Category>(ocrResult?.category ?? '食費')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    ocrResult?.payment_method ?? 'cash',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!ocrResult) {
    navigate('/camera', { replace: true })
    return null
  }

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
        transacted_at: ocrResult.date || new Date().toISOString(),
      })
      clearOcrResult()
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Save error:', err)
      setError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    clearOcrResult()
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 py-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleCancel}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          ←
        </button>
        <h2 className="text-xl font-bold text-white">内容を確認</h2>
      </div>

      <div className="space-y-5 flex-1">
        {/* Store name */}
        <div>
          <label className="block text-gray-400 text-sm mb-1.5">店舗名</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="店舗名（任意）"
            className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 border border-gray-800 focus:border-green-500 outline-none"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-gray-400 text-sm mb-1.5">金額</label>
          <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-4 py-3 border border-gray-800 focus-within:border-green-500">
            <span className="text-gray-400 text-lg font-medium">¥</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent text-white text-2xl font-bold outline-none"
            />
          </div>
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

        {/* OCR items */}
        {ocrResult.items && ocrResult.items.length > 0 && (
          <div>
            <label className="block text-gray-400 text-sm mb-2">OCR 読み取り内容</label>
            <div className="bg-gray-900 rounded-xl p-3 space-y-1.5">
              {ocrResult.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-300 truncate flex-1">{item.name}</span>
                  <span className="text-gray-500 flex-shrink-0 ml-2">
                    ¥{item.price.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-800 pt-1.5 mt-1.5 flex justify-between text-sm font-medium">
                <span className="text-gray-300">合計</span>
                <span className="text-white">¥{ocrResult.total_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

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
