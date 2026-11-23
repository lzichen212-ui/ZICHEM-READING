import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '首页', icon: 'home' },
  { to: '/study', label: '学习', icon: 'book' },
  { to: '/me', label: '我的', icon: 'user' }
]

export function Layout() {
  const loc = useLocation()
  const isRoot = loc.pathname === '/' || loc.pathname === '/study' || loc.pathname === '/me'
  return (
    <>
      <div className="app-shell">
        <Outlet />
      </div>
      {isRoot && (
        <nav className="tabbar">
          {tabs.map(t => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'on' : '')} end>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </>
  )
}
