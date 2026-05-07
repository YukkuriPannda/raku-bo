import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { CATEGORY_EMOJI } from '../types'
import type { Transaction } from '../types'

const PAYMENT_LABEL: Record<string, string> = {
  cash: '現金',
  card: 'カード',
  qr: 'QR',
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function History() {
  const { transactions, isLoading, fetchTransactions } = useAppStore()
  const [month, setMonth] = useState(currentMonth)

  useEffect(() => {
    fetchTransactions(month)
  }, [month])

  return (
    <div className="min-h-full bg-gray-950 px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">📋 履歴</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:border-green-500 outline-none"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🧾</p>
          <p className="text-gray-500">取引がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <TransactionRow key={t.id} tx={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const emoji = CATEGORY_EMOJI[tx.category] ?? '📦'
  const date = new Date(tx.transacted_at).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-3">
      <span className="text-2xl flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{tx.store_name ?? tx.category}</p>
        <p className="text-gray-500 text-xs">
          {date} · {tx.category} · {PAYMENT_LABEL[tx.payment_method] ?? tx.payment_method}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-red-400 font-semibold">¥{tx.amount.toLocaleString()}</p>
        {tx.points_earned != null && tx.points_earned > 0 && (
          <p className="text-yellow-400 text-xs">+{tx.points_earned}pt</p>
        )}
      </div>
    </div>
  )
}
