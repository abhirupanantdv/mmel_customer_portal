import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell, BookOpenText, ChevronLeft, ChevronRight, CircleHelp, CreditCard,
  LayoutDashboard, LogOut, Menu, Repeat2, Send, Settings, ShieldCheck,
  UserRound, WalletCards, X,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { DemoBanner } from '../components/DemoBanner'
import { useSession } from '../stores/session'

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/forex', label: 'Forex Exchange', icon: Repeat2 },
  { to: '/money-transfer', label: 'Money Transfer', icon: Send },
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

  const logout = () => { signOut(); navigate('/login') }

  return (
    <div className={collapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <aside className={mobileOpen ? 'sidebar mobile-open' : 'sidebar'} aria-label="Primary navigation">
        <div className="sidebar-head"><Logo compact={collapsed} /><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button></div>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Icon size={20} /><span>{label}</span>{label === 'Notifications' && <em>2</em>}
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
          <NavLink to="/notifications" className="icon-button" aria-label="Notifications"><Bell /><span>2</span></NavLink>
          <NavLink to="/profile" className="account-pill"><div className="avatar">AR</div><div><strong>Ahmed Rashid</strong><small>MH-00001258</small></div></NavLink>
        </header>
        <DemoBanner />
        <div className="page"><Outlet /></div>
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 5).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon /><span>{label.replace(' Exchange', '').replace('Money ', '')}</span></NavLink>)}
      </nav>
      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    </div>
  )
}
