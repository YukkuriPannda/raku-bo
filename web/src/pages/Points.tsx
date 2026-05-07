import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { pointApi } from '../lib/api'
import type { Point } from '../types'

export default function Points() {
  const { points, balance, fetchPoints } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Point | null>(null)

  useEffect(() => {
    fetchPoints()
  }, [])

  const handleDelete = async (id: string) => {
    if (!window.confirm('このポイントを削除しますか？')) return
    await pointApi.delete(id)
    await fetchPoints()
  }

  return (
    <div className="min-h-full bg-gray-950 px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">💎 ポイント</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-400 transition-colors"
        >
          + 追加
        </button>
      </div>

      {/* Total */}
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4 mb-5 text-center">
        <p className="text-gray-400 text-sm mb-1">ポイント合計（円換算）</p>
        <p className="text-yellow-400 text-3xl font-bold">
          ¥{balance.points_total_yen.toLocaleString()}
        </p>
      </div>

      {/* List */}
      {points.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">💎</p>
          <p className="text-gray-500">ポイントがありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {points.map((point) => (
            <PointRow
              key={point.id}
              point={point}
              onEdit={() => setEditing(point)}
              onDelete={() => handleDelete(point.id)}
            />
          ))}
        </div>
      )}

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSave={fetchPoints} />}
      {editing && (
        <EditModal point={editing} onClose={() => setEditing(null)} onSave={fetchPoints} />
      )}
    </div>
  )
}

function PointRow({
  point,
  onEdit,
  onDelete,
}: {
  point: Point
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-white font-medium">{point.name}</p>
        <p className="text-gray-500 text-sm">
          {point.amount.toLocaleString()} pt × {point.rate} 円 ={' '}
          <span className="text-yellow-400">¥{(point.amount * point.rate).toLocaleString()}</span>
        </p>
      </div>
      <div className="flex gap-1 ml-2 flex-shrink-0">
        <button
          onClick={onEdit}
          className="text-blue-400 text-sm px-2 py-1 rounded hover:bg-blue-900/30 transition-colors"
        >
          編集
        </button>
        <button
          onClick={onDelete}
          className="text-red-400 text-sm px-2 py-1 rounded hover:bg-red-900/30 transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  )
}

function AddModal({ onClose, onSave }: { onClose: () => void; onSave: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('1')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!name.trim() || !amount) return
    setLoading(true)
    try {
      await pointApi.create({
        name: name.trim(),
        amount: parseInt(amount, 10),
        rate: parseFloat(rate) || 1,
      })
      await onSave()
      onClose()
    } catch (err) {
      console.error(err)
      alert('追加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet title="ポイント追加" onClose={onClose}>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="名前（例：楽天ポイント）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:border-green-500 outline-none"
          autoFocus
        />
        <input
          type="number"
          placeholder="ポイント数"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:border-green-500 outline-none"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            placeholder="レート"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:border-green-500 outline-none"
          />
          <span className="text-gray-400 text-sm whitespace-nowrap">円 / pt</span>
        </div>
        <button
          onClick={handleAdd}
          disabled={loading || !name.trim() || !amount}
          className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-400 disabled:opacity-50 transition-colors"
        >
          {loading ? '追加中...' : '追加'}
        </button>
      </div>
    </BottomSheet>
  )
}

function EditModal({
  point,
  onClose,
  onSave,
}: {
  point: Point
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [amount, setAmount] = useState(String(point.amount))
  const [loading, setLoading] = useState(false)

  const handleUpdate = async () => {
    setLoading(true)
    try {
      await pointApi.update(point.id, parseInt(amount, 10))
      await onSave()
      onClose()
    } catch (err) {
      console.error(err)
      alert('更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet title={`${point.name} を編集`} onClose={onClose}>
      <div className="space-y-3">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:border-green-500 outline-none text-lg"
          autoFocus
        />
        <p className="text-gray-500 text-sm text-center">
          = ¥{((parseInt(amount) || 0) * point.rate).toLocaleString()}
        </p>
        <button
          onClick={handleUpdate}
          disabled={loading}
          className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-400 disabled:opacity-50 transition-colors"
        >
          {loading ? '更新中...' : '更新'}
        </button>
      </div>
    </BottomSheet>
  )
}

function BottomSheet({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode
  title: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-t-2xl w-full max-w-md p-6 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-4" />
        <h3 className="text-white font-bold text-lg mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
