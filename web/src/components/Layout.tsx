import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

const HIDE_NAV = ['/camera', '/confirm']

export default function Layout() {
  const { pathname } = useLocation()
  const showNav = !HIDE_NAV.includes(pathname)

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white max-w-md mx-auto relative">
      <main className={`flex-1 overflow-y-auto ${showNav ? 'pb-20' : ''}`}>
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  )
}
