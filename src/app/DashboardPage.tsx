import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, ChevronRight, CircleDollarSign, CircleHelp, CreditCard, Plus, RefreshCw, Repeat2, Send, ShieldCheck, WalletCards } from 'lucide-react'
import { Card, EmptyState } from '../components/ui'
import { StatusBadge } from '../components/StatusBadge'
import { dashboardApi } from '../services/dashboard'

const money = (amount: number, currency = 'FJD') => currency === 'FJD'
  ? `F$${amount.toLocaleString('en-FJ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : `${currency} ${amount.toLocaleString('en-FJ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const statusStep = (status: string) => ({ Pending: 1, 'In Review': 2, Approved: 3, Completed: 4 }[status] || 1)

export function DashboardPage() {
  const [chart, setChart] = useState<'requests' | 'wallet'>('requests')
  const query = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.getDashboard })
  const currentDate = format(new Date(), 'EEEE, d MMMM yyyy')

  if (query.isLoading) return <Card><div className="transaction-table-state"><RefreshCw className="spin" /> Loading your dashboard…</div></Card>
  if (query.isError || !query.data) return <Card><div className="notice error-notice"><CircleHelp />{query.error?.message || 'Your dashboard is temporarily unavailable.'}</div><button className="btn btn-secondary" onClick={() => query.refetch()}><RefreshCw />Try again</button></Card>

  const data = query.data
  const current = data.current_request
  const summary = [
    { label: 'Available wallet', value: money(data.wallet.available_balance, data.wallet.currency), detail: data.wallet.exists ? `${money(data.wallet.held_balance, data.wallet.currency)} currently held` : 'No wallet has been created', icon: WalletCards, tone: 'red', to: '/wallet' },
    { label: 'Open requests', value: String(data.requests.pending), detail: `${data.requests.completed} completed · ${data.requests.total} total`, icon: CalendarDays, tone: 'gold', to: '/transactions' },
    { label: 'Membership', value: data.membership.status, detail: `Profile ${data.membership.profile_review_status.toLowerCase()}`, icon: CreditCard, tone: 'blue', to: '/membership-card' },
    { label: 'RBF limit records', value: String(data.limits.usage_entries), detail: `${data.limits.rules} published rules available`, icon: ShieldCheck, tone: 'green', to: '/limits' },
  ]
  const actions = [
    { label: 'Buy currency', sub: 'Request foreign notes', icon: CircleDollarSign, to: '/forex/buy' },
    { label: 'Sell currency', sub: 'Convert foreign notes', icon: Repeat2, to: '/forex/sell' },
    { label: 'Send money', sub: 'Create transfer request', icon: Send, to: '/money-transfer/new' },
    { label: 'Add money', sub: 'Submit funding request', icon: Plus, to: '/wallet/add-money' },
    { label: 'Membership card', sub: 'View approval status', icon: CreditCard, to: '/membership-card' },
    { label: 'Check limits', sub: 'View RBF rules and usage', icon: ShieldCheck, to: '/limits' },
  ]
  return <>
    <div className="page-header"><div><span className="eyebrow">{currentDate}</span><h1>Welcome back, {data.customer.name.split(' ')[0] || 'Customer'}</h1><p>Your ERPNext wallet, requests, membership and compliance overview.</p></div><Link className="verification-pill" to="/profile/kyc"><BadgeCheck />Profile {data.membership.profile_review_status.toLowerCase()}<ChevronRight /></Link></div>
    <div className="summary-grid">{summary.map(({ icon: Icon, ...item }) => <Link to={item.to} className={`summary-card ${item.tone}`} key={item.label}><div className="summary-icon"><Icon /></div><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small><ArrowRight className="summary-arrow" /></Link>)}</div>
    <div className="dashboard-grid">
      <Card className="quick-actions"><div className="card-heading"><div><span className="eyebrow">Get things done</span><h2>Quick actions</h2></div></div><div className="action-grid">{actions.map(({ icon: Icon, ...action }) => <Link to={action.to} className="action-tile" key={action.label}><span><Icon /></span><div><strong>{action.label}</strong><small>{action.sub}</small></div><ChevronRight /></Link>)}</div></Card>
      <Card className="activity-card"><div className="card-heading"><div><span className="eyebrow">Current request</span><h2>{current ? current.type : 'No open requests'}</h2></div>{current && <StatusBadge status={current.status} />}</div>{current ? <><div className="booking-highlight"><div className="flag">{current.type === 'Forex Exchange' ? 'FX' : 'MT'}</div><div><strong>{money(current.amount, current.currency)}</strong><span>{current.reference} · {current.branch}</span></div></div><div className="timeline-mini">{[1, 2, 3, 4].map(step => <i key={step} className={step <= statusStep(current.status) ? 'done' : ''} />)}<span>{current.status === 'Approved' ? 'Approved and awaiting operator completion.' : current.status === 'In Review' ? 'An operator is reviewing this request.' : 'Submitted and awaiting branch review.'}</span></div><Link className="btn btn-primary w-full" to={`/transactions/${current.id}`}>View request details</Link></> : <EmptyState icon={<CalendarDays />} title="Nothing awaiting action" body="New Forex and Money Transfer requests will appear here while they are being processed." />}</Card>
    </div>
    <div className="dashboard-grid lower">
      <Card><div className="card-heading"><div><span className="eyebrow">ERPNext activity</span><h2>Six-month overview</h2></div><div className="segmented"><button className={chart === 'requests' ? 'active' : ''} onClick={() => setChart('requests')}>Forex & transfers</button><button className={chart === 'wallet' ? 'active' : ''} onClick={() => setChart('wallet')}>Wallet</button></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%">{chart === 'requests' ? <BarChart data={data.activity}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eaee" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip formatter={(value) => money(Number(value))} /><Legend /><Bar name="Forex requests" dataKey="forex" fill="#c70d18" radius={[5, 5, 0, 0]} /><Bar name="Transfer requests" dataKey="transfers" fill="#252a31" radius={[5, 5, 0, 0]} /></BarChart> : <AreaChart data={data.activity}><defs><linearGradient id="walletIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0e9f6e" stopOpacity={.3}/><stop offset="95%" stopColor="#0e9f6e" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eaee" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip formatter={(value) => money(Number(value))} /><Legend /><Area name="Wallet credits" type="monotone" dataKey="wallet_in" stroke="#0e9f6e" fill="url(#walletIn)" /><Area name="Wallet debits" type="monotone" dataKey="wallet_out" stroke="#c70d18" fill="#c70d1815" /></AreaChart>}</ResponsiveContainer></div><small className="dashboard-chart-note">Request charts show submitted request values. Wallet charts show posted ledger entries.</small></Card>
      <Card><div className="card-heading"><div><span className="eyebrow">Customer-owned requests</span><h2>Recent activity</h2></div><Link to="/transactions">View all</Link></div>{data.recent_requests.length ? <div className="recent-list">{data.recent_requests.map(row => <Link to={`/transactions/${row.id}`} key={row.id}><span className={`transaction-icon ${row.direction}`}>{row.direction === 'credit' ? <ArrowDownLeft /> : <ArrowUpRight />}</span><div><strong>{row.description}</strong><small>{format(parseISO(row.date), 'dd MMM')} · {row.reference}</small></div><div className="transaction-amount"><strong className={row.direction}>{row.direction === 'credit' ? '+' : '−'}{money(row.amount, row.currency)}</strong><StatusBadge status={row.status} /></div></Link>)}</div> : <EmptyState icon={<RefreshCw />} title="No request activity" body="Your submitted Forex and Money Transfer requests will appear here." />}</Card>
    </div>
  </>
}
