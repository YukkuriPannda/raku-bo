import { NavLink } from 'react-router-dom'

const TABS = [
  { path: '/', icon: '🏠', label: 'ホーム', end: true },
  { path: '/history', icon: '📋', label: '履歴', end: false },
  { path: '/shifts', icon: '📅', label: 'シフト', end: false },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gray-900 border-t border-gray-800 h-16 flex items-center z-20">
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
              isActive ? 'text-green-500' : 'text-gray-400 hover:text-gray-200'
            }`
          }
        >
          <span className="text-xl">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
