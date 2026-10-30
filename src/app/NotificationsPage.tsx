import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, ChevronRight, CircleHelp, CreditCard, FileCheck2, RefreshCw, Repeat2, Send, WalletCards } from 'lucide-react'
import { Button, Card, EmptyState } from '../components/ui'
import { notificationApi, type PortalNotification } from '../services/notifications'

function NotificationIcon({ item }: { item: PortalNotification }) {
  if (item.document_type === 'Customer Wallet Request') return <WalletCards />
  if (item.document_type === 'Customer Portal KYC Document') return <FileCheck2 />
  if (item.document_type === 'Customer Membership Card') return <CreditCard />
  if (item.document_type === 'Customer Forex Request') return <Repeat2 />
  if (item.document_type === 'Customer Money Transfer Request') return <Send />
  return <Bell />
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [view, setView] = useState<'all' | 'unread'>('all')
  const inbox = useQuery({ queryKey: ['portal-notifications'], queryFn: () => notificationApi.list(), refetchInterval: 60_000 })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['portal-notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['portal-notification-count'] })
  }
  const markRead = useMutation({ mutationFn: notificationApi.markRead, onSuccess: refresh })
  const markAll = useMutation({ mutationFn: notificationApi.markAllRead, onSuccess: refresh })
  const items = (inbox.data?.notifications ?? []).filter(item => view === 'all' || !item.read)
  const open = async (item: PortalNotification) => {
    try {
      if (!item.read) await markRead.mutateAsync(item.name)
    } catch {
      return
    }
    if (item.route) navigate(item.route)
  }

  if (inbox.isLoading) return <Card><div className="transaction-table-state"><RefreshCw className="spin" />Loading ERPNext notifications…</div></Card>
  if (inbox.isError || !inbox.data) return <Card><div className="notice error-notice"><CircleHelp />{inbox.error?.message || 'Notifications are temporarily unavailable.'}</div><Button variant="secondary" onClick={() => inbox.refetch()}><RefreshCw />Try again</Button></Card>

  return <>
    <div className="page-header"><div><span className="eyebrow">ERPNext updates</span><h1>Notifications</h1><p>Follow changes to your requests, wallet, KYC documents and membership card.</p></div><Button variant="ghost" onClick={() => markAll.mutate()} disabled={!inbox.data.unread_count || markAll.isPending}><CheckCheck />{markAll.isPending ? 'Updating…' : 'Mark all as read'}</Button></div>
    <Card className="notification-inbox-toolbar"><div className="segmented"><button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>All <span>{inbox.data.total}</span></button><button className={view === 'unread' ? 'active' : ''} onClick={() => setView('unread')}>Unread <span>{inbox.data.unread_count}</span></button></div><Button variant="ghost" onClick={() => inbox.refetch()} disabled={inbox.isFetching}><RefreshCw className={inbox.isFetching ? 'spin' : ''} />Refresh</Button></Card>
    {markRead.isError && <div className="notice error-notice"><CircleHelp />The notification could not be updated. Please try again.</div>}
    <Card className="notifications-card">{items.length ? items.map(item => <button key={item.name} className={item.read ? 'notification' : 'notification unread'} onClick={() => void open(item)} disabled={markRead.isPending}><span className="notification-icon"><NotificationIcon item={item} /></span><div><strong>{item.subject}</strong>{item.message && <p>{item.message}</p>}<small>{formatDistanceToNow(parseISO(item.creation), { addSuffix: true })}{item.document_name ? ` · ${item.document_name}` : ''}</small></div>{!item.read && <i aria-label="Unread" />}{item.route && <ChevronRight />}</button>) : <EmptyState icon={<Bell />} title={view === 'unread' ? 'You are all caught up' : 'No notifications yet'} body={view === 'unread' ? 'There are no unread ERPNext alerts.' : 'Status updates from ERPNext will appear here.'} />}</Card>
  </>
}
