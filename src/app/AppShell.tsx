import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell, BookOpenText, ChevronLeft, ChevronRight, CircleHelp, CreditCard,
  Gift, LayoutDashboard, LogOut, Menu, Repeat2, Send, Settings, ShieldCheck,
  UserRound, WalletCards, X,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { useSession } from '../stores/session'
import { notificationApi } from '../services/notifications'

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/forex', label: 'Forex Exchange', icon: Repeat2 },
  { to: '/money-transfer', label: 'Money Transfer', icon: Send },
  { to: '/gifts', label: 'Gift Your Loved Ones', icon: Gift },
  { to: '/wallet', label: 'My Wallet', icon: WalletCards },
  { to: '/transactions', label: 'Transactions', icon: BookOpenText },
  { to: '/statements', label: 'Statements', icon: CreditCard },
  { to: '/membership-card', label: 'Membership Card', icon: CreditCard },
  { to: '/limits', label: 'My Limits', icon: ShieldCheck },
  { to: '/profile', label: 'Profile & KYC', icon: UserRound },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/support', label: 'Help & Support', icon: CircleHelp },
]

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const signOut = useSession((s) => s.signOut)
  const customer = useSession((s) => s.customer)
  const unread = useQuery({ queryKey: ['portal-notification-count'], queryFn: notificationApi.unreadCount, refetchInterval: 60_000 })
  const unreadCount = unread.data?.unread_count ?? 0

  const logout = async () => { await signOut(); navigate('/login') }

  return (
    <div className={collapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <aside className={mobileOpen ? 'sidebar mobile-open' : 'sidebar'} aria-label="Primary navigation">
        <div className="sidebar-head"><Logo compact={collapsed} hideLabel /><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button></div>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Icon size={20} /><span>{label}</span>{label === 'Notifications' && unreadCount > 0 && <em>{unreadCount > 99 ? '99+' : unreadCount}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/settings" className="nav-link"><Settings size={20} /><span>Settings</span></NavLink>
          <button className="nav-link logout" onClick={logout}><LogOut size={20} /><span>Secure logout</span></button>
        </div>
        <button className="collapse-toggle" onClick={() => setCollapsed((v) => !v)} aria-label="Toggle sidebar">{collapsed ? <ChevronRight /> : <ChevronLeft />}</button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="topbar-spacer" />
          <NavLink to="/notifications" className="icon-button" aria-label={`${unreadCount} unread notifications`}><Bell />{unreadCount > 0 && <span>{unreadCount > 99 ? '99+' : unreadCount}</span>}</NavLink>
          <NavLink to="/profile" className="account-pill"><div className="avatar">{customer?.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'MH'}</div><div><strong>{customer?.full_name || 'Customer'}</strong><small>{customer?.customer_id || 'ERPNext profile'}</small></div></NavLink>
        </header>
        <div className="page"><Outlet /></div>
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 5).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon /><span>{label.replace(' Exchange', '').replace('Money ', '')}</span></NavLink>)}
      </nav>
      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    </div>
  )
}
