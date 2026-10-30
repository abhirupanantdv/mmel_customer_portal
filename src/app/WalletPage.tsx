import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, subDays } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Award, CircleHelp, Download, FileText, Landmark, LockKeyhole, Plus, Printer, WalletCards } from 'lucide-react'
import { Button, Card, EmptyState, Field, Input } from '../components/ui'
import { StatusBadge } from '../components/StatusBadge'
import { walletApi, type WalletLedgerEntry, type WalletRequestType } from '../services/wallet'

const money = (amount: number, currency = 'FJD') => new Intl.NumberFormat('en-FJ', {
  style: 'currency', currency, currencyDisplay: currency === 'FJD' ? 'narrowSymbol' : 'code',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(amount).replace('$', currency === 'FJD' ? 'F$' : '$')

const when = (value?: string) => value ? format(parseISO(value), 'dd MMM yyyy, h:mm a') : 'No activity yet'

function LedgerRows({ rows }: { rows: WalletLedgerEntry[] }) {
  if (!rows.length) return <EmptyState icon={<WalletCards />} title="No wallet entries" body="Posted funding, withdrawal and wallet-use entries will appear here." />
  return <div className="wallet-ledger-list">{rows.map(row => <div key={row.name}>
    <span className={`transaction-icon ${row.direction}`}>{row.direction === 'credit' ? <ArrowDownLeft /> : <ArrowUpRight />}</span>
    <div><strong>{row.description || row.transaction_type}</strong><small>{when(row.posting_datetime)} · {row.name}</small></div>
    <div className="transaction-amount"><strong className={row.direction}>{row.direction === 'credit' ? '+' : row.direction === 'debit' ? '−' : ''}{money(row.amount, row.currency)}</strong><small>Balance {money(row.available_balance_after, row.currency)}</small></div>
  </div>)}</div>
}

export function WalletPage() {
  const summary = useQuery({ queryKey: ['wallet-summary'], queryFn: walletApi.getWallet })
  if (summary.isLoading) return <Card><div className="transaction-table-state">Loading your wallet…</div></Card>
  if (summary.isError || !summary.data) return <Card><div className="notice error-notice"><CircleHelp />{summary.error?.message || 'Wallet information is unavailable.'}</div></Card>
  const data = summary.data
  const wallet = data.wallet
  return <>
    <div className="page-header"><div><span className="eyebrow">ERPNext wallet ledger</span><h1>My wallet</h1><p>View settled balances, request funding or withdrawal, and review loyalty rewards.</p></div><Link className={`btn btn-primary${!data.enabled ? ' disabled' : ''}`} to={data.enabled ? '/wallet/add-money' : '/wallet'} aria-disabled={!data.enabled}><Plus />Add money</Link></div>
    {!data.enabled && <div className="notice"><LockKeyhole />The wallet is awaiting final ERPNext accounting configuration. Balances remain read-only.</div>}
    <div className="wallet-hero"><div><span>Available balance</span><strong>{money(wallet.available_balance, wallet.currency)}</strong><small>{wallet.name} · {wallet.status} · Last entry: {when(wallet.last_transaction_on)}</small></div><div className="wallet-hero-actions"><Link to="/wallet/transactions">View ledger</Link><Link to="/wallet/statement">Download statement</Link></div></div>
    <div className="wallet-grid">
      <Card><WalletCards /><span>Available</span><strong>{money(wallet.available_balance, wallet.currency)}</strong></Card>
      <Card><LockKeyhole /><span>Held for transactions</span><strong>{money(wallet.held_balance, wallet.currency)}</strong></Card>
      <Card><Landmark /><span>Pending requests</span><strong>{data.pending_requests}</strong></Card>
      <Card><Award /><span>Loyalty points</span><strong>{data.loyalty.configured ? data.loyalty.points.toLocaleString() : 'Not configured'}</strong></Card>
    </div>
    <div className="dashboard-grid">
      <Card><div className="card-heading"><div><span className="eyebrow">Posted entries</span><h2>Recent wallet activity</h2></div><Link to="/wallet/transactions">View all</Link></div><LedgerRows rows={data.recent_transactions} /></Card>
      <Card className="loyalty-card"><div className="card-heading"><div><span className="eyebrow">ERPNext loyalty</span><h2>{data.loyalty.program || 'Loyalty programme'}</h2></div><Award /></div>{data.loyalty.configured ? <><strong className="loyalty-points">{data.loyalty.points.toLocaleString()} points</strong><p>Current redemption value: {money(data.loyalty.value, data.loyalty.currency)}{data.loyalty.tier ? ` · ${data.loyalty.tier}` : ''}</p><small>Loyalty points are rewards and are not part of the withdrawable wallet cash balance.</small></> : <><p>No Loyalty Program is assigned to your ERPNext Customer record yet.</p><small>Once configured by an operator, points and expiry activity will appear here separately from wallet funds.</small></>}</Card>
    </div>
  </>
}

export function WalletRequestPage({ requestType = 'Funding' }: { requestType?: WalletRequestType }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const summary = useQuery({ queryKey: ['wallet-summary'], queryFn: walletApi.getWallet })
  const requests = useQuery({ queryKey: ['wallet-requests'], queryFn: () => walletApi.listRequests(10) })
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Bank Transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submittedId, setSubmittedId] = useState('')
  const create = useMutation({
    mutationFn: () => walletApi.createRequest({ request_type: requestType, amount, funding_method: method, payment_reference: reference, customer_notes: notes }),
    onSuccess: result => { setSubmittedId(result.name); setAmount(''); setReference(''); setNotes(''); void queryClient.invalidateQueries({ queryKey: ['wallet-requests'] }); void queryClient.invalidateQueries({ queryKey: ['wallet-summary'] }) },
  })
  const limits = summary.data?.request_limits
  const title = requestType === 'Funding' ? 'Add money' : 'Withdraw money'
  return <>
    <div className="page-header"><div><Link className="text-link" to="/wallet"><ArrowLeft />Back to wallet</Link><span className="eyebrow">Operator-approved request</span><h1>{title}</h1><p>{requestType === 'Funding' ? 'Submit your intended funding method and reference. Funds are credited only after an operator verifies settlement.' : 'Request payout from your available balance. An operator must approve and post the withdrawal.'}</p></div></div>
    <div className="wallet-request-layout"><Card><form className="quote-form" onSubmit={event => { event.preventDefault(); create.mutate() }}>
      <div className="form-row"><Field label="Amount (FJD)"><Input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" required /></Field><Field label={requestType === 'Funding' ? 'Funding method' : 'Payout method'}><select className="input" value={method} onChange={event => setMethod(event.target.value)}>{['Bank Transfer', 'Cash Deposit', 'M-PAiSA', 'MyCash', 'Other'].map(item => <option key={item}>{item}</option>)}</select></Field></div>
      <Field label="Payment reference (optional)"><Input value={reference} onChange={event => setReference(event.target.value)} maxLength={140} placeholder="Bank, mobile-wallet or deposit reference" /></Field>
      <Field label="Notes for the operator (optional)"><textarea className="input" rows={3} value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} /></Field>
      {limits && <small>Allowed request amount: {money(limits.minimum)} to {money(limits.maximum)}.</small>}
      {create.isError && <div className="notice error-notice"><CircleHelp />{create.error.message}</div>}
      {submittedId && <div className="notice success-notice"><FileText /><span>Request <strong>{submittedId}</strong> was submitted for operator review. <button type="button" className="text-link" onClick={() => walletApi.printRequestReceipt(submittedId)}>Print receipt</button></span></div>}
      <Button type="submit" disabled={create.isPending || !summary.data?.enabled}>{create.isPending ? 'Submitting…' : `Submit ${requestType.toLowerCase()} request`}</Button>
      {requestType === 'Funding' && summary.data?.allow_withdrawals && <Button type="button" variant="ghost" onClick={() => navigate('/wallet/withdraw')}>Request a withdrawal instead</Button>}
    </form></Card>
    <Card><div className="card-heading"><div><span className="eyebrow">Recent requests</span><h2>Operator status</h2></div></div>{requests.isLoading ? <div className="transaction-table-state">Loading requests…</div> : !requests.data?.length ? <EmptyState icon={<FileText />} title="No wallet requests" body="Your funding and withdrawal requests will appear here." /> : <div className="wallet-request-list">{requests.data.map(item => <div key={item.name}><div><strong>{item.name}</strong><small>{item.request_type} · {when(item.submitted_on)} · {item.funding_method}</small></div><div><strong>{money(item.amount, item.currency)}</strong><StatusBadge status={item.status} /></div><div className="wallet-request-actions"><button onClick={() => walletApi.printRequestReceipt(item.name)} aria-label={`Print ${item.name}`}><Printer /></button><button onClick={() => walletApi.downloadRequestReceipt(item.name)} aria-label={`Download ${item.name}`}><Download /></button></div></div>)}</div>}</Card></div>
  </>
}

export function WalletTransactionsPage() {
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const ledger = useQuery({ queryKey: ['wallet-ledger', page, type], queryFn: () => walletApi.listTransactions(page, type) })
  return <><div className="page-header"><div><Link className="text-link" to="/wallet"><ArrowLeft />Back to wallet</Link><span className="eyebrow">Authoritative ledger</span><h1>Wallet transactions</h1><p>Every displayed entry is posted by ERPNext and includes its resulting available balance.</p></div><select className="small-select" value={type} onChange={event => { setType(event.target.value); setPage(1) }}><option value="">All types</option>{['Funding', 'Withdrawal', 'Hold', 'Release', 'Capture', 'Refund', 'Reversal', 'Adjustment'].map(item => <option key={item}>{item}</option>)}</select></div><Card>{ledger.isLoading ? <div className="transaction-table-state">Loading wallet ledger…</div> : ledger.isError ? <div className="notice error-notice"><CircleHelp />{ledger.error.message}</div> : <LedgerRows rows={ledger.data?.data ?? []} />}{ledger.data && <div className="table-footer"><span>{ledger.data.pagination.total} entries</span><div><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page} of {ledger.data.pagination.total_pages}</span><Button variant="ghost" disabled={page >= ledger.data.pagination.total_pages} onClick={() => setPage(value => value + 1)}>Next</Button></div></div>}</Card></>
}

export function WalletStatementPage() {
  const [start, setStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [end, setEnd] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const download = async () => { setDownloading(true); setError(''); try { await walletApi.downloadStatement(start, end) } catch (reason) { setError(reason instanceof Error ? reason.message : 'The statement could not be downloaded.') } finally { setDownloading(false) } }
  return <><div className="page-header"><div><Link className="text-link" to="/wallet"><ArrowLeft />Back to wallet</Link><span className="eyebrow">Posted ledger statement</span><h1>Wallet statement</h1><p>Generate a secure PDF containing posted wallet entries for a period of up to one year.</p></div></div><Card className="statement-builder"><div className="form-row"><Field label="Start date"><Input type="date" value={start} onChange={event => setStart(event.target.value)} /></Field><Field label="End date"><Input type="date" value={end} onChange={event => setEnd(event.target.value)} /></Field></div>{error && <div className="notice error-notice"><CircleHelp />{error}</div>}<div className="receipt-actions"><Button onClick={download} disabled={downloading}><Download />{downloading ? 'Generating…' : 'Download PDF'}</Button><Button variant="secondary" onClick={() => walletApi.printStatement(start, end)}><Printer />Print statement</Button></div></Card></>
}
