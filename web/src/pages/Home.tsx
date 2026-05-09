import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function yen(amount: number) {
  return `¥${Math.abs(amount).toLocaleString()}`
}

export default function Home() {
  const navigate = useNavigate()
  const { balance, isLoading, fetchTransactions, fetchPoints, fetchShifts, logout, user } =
    useAppStore()
  const [month, setMonth] = useState(currentMonth)
  const [fabOpen, setFabOpen] = useState(false)

  const loadAll = () =>
    Promise.all([fetchTransactions(month), fetchPoints(), fetchShifts(month)])

  useEffect(() => {
    loadAll()
  }, [month])

  const isNegative = balance.remaining < 0

  return (
    <div className="min-h-full bg-gray-950 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">らく〜ぼ</h1>
          {user && <p className="text-gray-500 text-xs">{user.email}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:border-green-500 outline-none"
          />
          <button
            onClick={logout}
            className="text-gray-500 text-xs hover:text-gray-300 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* Remaining Budget */}
      <div
        className={`rounded-2xl p-6 mb-4 text-center ${
          isNegative
            ? 'bg-red-900/30 border border-red-800'
            : 'bg-green-900/20 border border-green-800'
        }`}
      >
        <p className="text-gray-400 text-sm mb-2">今月の残り</p>
        {isLoading ? (
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto my-2" />
        ) : (
          <p
            className={`text-5xl font-bold tracking-tight ${
              isNegative ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {isNegative ? '-' : ''}
            {yen(balance.remaining)}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SummaryCard label="支出" value={yen(balance.expense_total)} color="text-red-400" />
        <SummaryCard
          label="収入見込み"
          value={yen(balance.income_forecast)}
          color="text-blue-400"
        />
        <SummaryCard
          label="ポイント"
          value={yen(balance.points_total_yen)}
          color="text-yellow-400"
        />
      </div>

      {/* Refresh */}
      <button
        onClick={loadAll}
        disabled={isLoading}
        className="w-full bg-gray-800 text-gray-300 py-3 rounded-xl mb-4 hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm"
      >
        {isLoading ? '読み込み中...' : '🔄 更新'}
      </button>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/history')}
          className="bg-gray-900 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors"
        >
          <span className="text-2xl block mb-1">📋</span>
          <span className="text-white text-sm font-medium">履歴を見る</span>
        </button>
        <button
          onClick={() => navigate('/shifts')}
          className="bg-gray-900 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors"
        >
          <span className="text-2xl block mb-1">📅</span>
          <span className="text-white text-sm font-medium">シフト確認</span>
        </button>
      </div>

      {/* FAB: Speed dial */}
      <div className="fixed bottom-20 right-4 flex flex-col items-end gap-3 z-10">
        {fabOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 -z-10"
              onClick={() => setFabOpen(false)}
            />
            {/* Camera option */}
            <div className="flex items-center gap-3">
              <span className="text-white text-sm bg-gray-800/90 px-3 py-1.5 rounded-lg whitespace-nowrap shadow">
                レシート撮影
              </span>
              <button
                onClick={() => { setFabOpen(false); navigate('/camera') }}
                className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-xl shadow-lg hover:bg-green-400 active:scale-95 transition-all"
                aria-label="レシート撮影"
              >
                📷
              </button>
            </div>
            {/* Manual entry option */}
            <div className="flex items-center gap-3">
              <span className="text-white text-sm bg-gray-800/90 px-3 py-1.5 rounded-lg whitespace-nowrap shadow">
                手動入力
              </span>
              <button
                onClick={() => { setFabOpen(false); navigate('/manual-entry') }}
                className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-xl shadow-lg hover:bg-blue-400 active:scale-95 transition-all"
                aria-label="手動入力"
              >
                ✏️
              </button>
            </div>
          </>
        )}
        {/* Main FAB */}
        <button
          onClick={() => setFabOpen((o) => !o)}
          className={`w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-2xl shadow-lg hover:bg-green-400 active:scale-95 transition-all ${
            fabOpen ? 'rotate-45' : ''
          }`}
          aria-label="支出を追加"
        >
          ➕
        </button>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-3 text-center">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`font-semibold text-sm ${color}`}>{value}</p>
    </div>
  )
}
