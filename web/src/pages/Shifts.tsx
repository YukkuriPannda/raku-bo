import { useEffect, useState } from 'react'
import { useAppStore } from '../store'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function Shifts() {
  const { shifts, balance, hourlyWage, shiftKeywords, isLoading, calendarError, clearCalendarError, fetchShifts, setHourlyWage, setShiftKeywords } = useAppStore()
  const [month, setMonth] = useState(currentMonth)
  const [wageInput, setWageInput] = useState(String(hourlyWage))
  const [keywordsInput, setKeywordsInput] = useState(shiftKeywords.join('\n'))

  useEffect(() => {
    fetchShifts(month)
  }, [month])

  useEffect(() => {
    setKeywordsInput(shiftKeywords.join('\n'))
  }, [shiftKeywords])

  const commitKeywords = async () => {
    const keywords = keywordsInput
      .split('\n')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
    if (keywords.length > 0) {
      await setShiftKeywords(keywords)
    }
  }

  const commitWage = () => {
    const val = parseInt(wageInput, 10)
    if (!isNaN(val) && val > 0) {
      setHourlyWage(val)
    } else {
      setWageInput(String(hourlyWage))
    }
  }

  return (
    <div className="min-h-full bg-gray-950 px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">📅 シフト</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:border-green-500 outline-none"
        />
      </div>

      {/* Calendar error */}
      {calendarError && (
        <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-3 mb-4 flex items-start justify-between gap-3">
          <p className="text-red-400 text-sm leading-relaxed">{calendarError}</p>
          <button
            onClick={clearCalendarError}
            className="text-red-400 hover:text-red-300 text-lg font-semibold leading-none flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hourly Wage */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <label className="block text-gray-400 text-sm mb-2">時給設定</label>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-lg">¥</span>
          <input
            type="number"
            value={wageInput}
            onChange={(e) => setWageInput(e.target.value)}
            onBlur={commitWage}
            onKeyDown={(e) => e.key === 'Enter' && commitWage()}
            className="flex-1 bg-gray-800 text-white text-xl font-semibold rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 outline-none"
          />
          <span className="text-gray-400 text-sm">円 / 時</span>
        </div>
      </div>

      {/* Shift keywords */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <label className="block text-gray-400 text-sm mb-1">シフト検出キーワード</label>
        <p className="text-gray-600 text-xs mb-2">1行に1つ入力 · 保存は Ctrl+Enter または入力欄外クリック</p>
        <textarea
          value={keywordsInput}
          onChange={(e) => setKeywordsInput(e.target.value)}
          onBlur={commitKeywords}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault()
              commitKeywords()
            }
          }}
          rows={4}
          className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 outline-none resize-none"
          placeholder={'バイト\nシフト\n出勤\n勤務'}
        />
      </div>

      {/* Income forecast */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4 mb-5 text-center">
        <p className="text-gray-400 text-sm mb-1">今月の収入見込み</p>
        <p className="text-blue-400 text-3xl font-bold">
          ¥{balance.income_forecast.toLocaleString()}
        </p>
      </div>

      {/* Shifts list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500 text-sm">シフトがありません</p>
          <p className="text-gray-600 text-xs mt-1">Googleカレンダーにシフトを登録してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((shift) => {
            const start = new Date(shift.start)
            const end = new Date(shift.end)
            const dateStr = start.toLocaleDateString('ja-JP', {
              month: 'short',
              day: 'numeric',
              weekday: 'short',
            })
            const startTime = start.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })
            const endTime = end.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={shift.id}
                className="bg-gray-900 rounded-xl p-4 flex justify-between items-start"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium truncate">{shift.title}</p>
                  <p className="text-gray-400 text-sm">
                    {dateStr} {startTime}〜{endTime}
                  </p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {shift.duration_hours.toFixed(1)} 時間
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-green-400 font-semibold">
                    ¥{shift.estimated_wage.toLocaleString()}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
