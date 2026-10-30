import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleHelp, Download, FileText, Printer, Search } from 'lucide-react'
import { Button, Card, EmptyState, Input } from '../components/ui'
import { StatusBadge } from '../components/StatusBadge'
import { forexApi } from '../services/forex'
import { moneyTransferApi } from '../services/moneyTransfer'
import { transactionsApi, type PortalTransaction } from '../services/transactions'

const money = (amount: number, currency = 'FJD') => new Intl.NumberFormat('en-FJ', {
  style: 'currency', currency, currencyDisplay: currency === 'FJD' ? 'narrowSymbol' : 'code',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(amount).replace('$', currency === 'FJD' ? 'F$' : '$')

const displayDate = (value?: string) => value ? format(parseISO(value), 'dd MMM yyyy, h:mm a') : 'Not completed'

function receiptActions(transaction: PortalTransaction) {
  return transaction.receipt_type === 'forex'
    ? { download: () => forexApi.downloadReceipt(transaction.reference), print: () => forexApi.printReceipt(transaction.reference) }
    : { download: () => moneyTransferApi.downloadReceipt(transaction.reference), print: () => moneyTransferApi.printReceipt(transaction.reference) }
}

function ReceiptButtons({ transaction, compact = false }: { transaction: PortalTransaction; compact?: boolean }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const receipt = receiptActions(transaction)
  const download = async () => {
    setDownloading(true)
    setError('')
    try { await receipt.download() } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The receipt could not be downloaded.')
    } finally { setDownloading(false) }
  }
  return <div className={`transaction-receipt-actions${compact ? ' compact' : ''}`}>
    <Button type="button" variant="ghost" onClick={receipt.print} aria-label={`Print receipt ${transaction.reference}`}><Printer />{compact ? '' : 'Print receipt'}</Button>
    <Button type="button" variant="ghost" onClick={download} disabled={downloading} aria-label={`Download receipt ${transaction.reference}`}><Download />{compact ? '' : downloading ? 'Downloading…' : 'Download receipt'}</Button>
    {error && <small className="receipt-error" role="alert">{error}</small>}
  </div>
}

function exportCsv(rows: PortalTransaction[]) {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const headings = ['Date', 'Request ID', 'Operational Reference', 'Type', 'Description', 'Amount', 'Currency', 'Status', 'Branch']
  const content = [headings, ...rows.map(row => [
    row.date, row.reference, row.operational_reference, row.type, row.description,
    row.amount.toFixed(2), row.currency, row.status, row.branch,
  ])].map(values => values.map(escape).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `mh-money-express-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [transactionType, setTransactionType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const history = useQuery({
    queryKey: ['portal-transactions', page, search, transactionType, status],
    queryFn: () => transactionsApi.list({ page, pageLength: 20, search, transactionType, status }),
  })
  const rows = history.data?.data ?? []
  const pagination = history.data?.pagination
  const summary = history.data?.summary
  const changeFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1) }

  return <>
    <div className="page-header"><div><span className="eyebrow">ERPNext history</span><h1>Transactions</h1><p>Track your foreign exchange and money transfer requests, operator status, and completed references.</p></div><Button variant="secondary" onClick={() => exportCsv(rows)} disabled={!rows.length}><Download />Export current page</Button></div>
    <div className="transaction-summary-grid">
      <Card><span>All requests</span><strong>{summary?.total ?? '—'}</strong></Card>
      <Card><span>In progress</span><strong>{summary?.pending ?? '—'}</strong></Card>
      <Card><span>Completed</span><strong>{summary?.completed ?? '—'}</strong></Card>
      <Card><span>Closed without completion</span><strong>{summary?.rejected_or_cancelled ?? '—'}</strong></Card>
    </div>
    <Card className="table-card transaction-history-card">
      <div className="table-toolbar">
        <label className="search-box" aria-label="Search transactions"><Search /><Input placeholder="Search request, branch, country or recipient" value={search} onChange={event => changeFilter(setSearch, event.target.value)} /></label>
        <div className="filter-row">
          <select className="small-select" aria-label="Transaction type" value={transactionType} onChange={event => changeFilter(setTransactionType, event.target.value)}><option value="">All types</option>{history.data?.filters.types.map(type => <option key={type}>{type}</option>)}</select>
          <select className="small-select" aria-label="Transaction status" value={status} onChange={event => changeFilter(setStatus, event.target.value)}><option value="">All statuses</option>{history.data?.filters.statuses.map(item => <option key={item}>{item}</option>)}</select>
        </div>
      </div>
      {history.isLoading && <div className="transaction-table-state">Loading your ERPNext history…</div>}
      {history.isError && <div className="notice error-notice"><CircleHelp />{history.error.message}</div>}
      {!history.isLoading && !history.isError && !rows.length && <EmptyState icon={<FileText />} title="No matching transactions" body="Your submitted foreign exchange and money transfer requests will appear here." />}
      {!!rows.length && <div className="table-scroll"><table><thead><tr><th>Date</th><th>Reference</th><th>Transaction</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>
        <td><span className="table-primary">{format(parseISO(row.date), 'dd MMM yyyy')}</span><small>{format(parseISO(row.date), 'h:mm a')}</small></td>
        <td><strong>{row.reference}</strong>{row.operational_reference && <small>Operational: {row.operational_reference}</small>}</td>
        <td><strong>{row.description}</strong><small>{row.type} · {row.branch}</small></td>
        <td><strong className={row.direction}>{row.direction === 'credit' ? '+' : '−'}{money(row.amount, row.currency)}</strong><small>{row.type === 'Forex Exchange' ? 'Estimated total' : 'Send amount'}</small></td>
        <td><StatusBadge status={row.status} /></td>
        <td><div className="transaction-row-actions"><Link className="btn btn-ghost" to={`/transactions/${encodeURIComponent(row.id)}`}>View</Link><ReceiptButtons transaction={row} compact /></div></td>
      </tr>)}</tbody></table></div>}
      {!!pagination && <div className="table-footer"><span>Showing {rows.length} of {pagination.total} matching records</span><div><Button variant="ghost" disabled={page <= 1 || history.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {pagination.page} of {pagination.total_pages}</span><Button variant="ghost" disabled={page >= pagination.total_pages || history.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></div></div>}
    </Card>
  </>
}

export function TransactionDetailsPage() {
  const { id = '' } = useParams()
  const detail = useQuery({ queryKey: ['portal-transaction', id], queryFn: () => transactionsApi.get(id), enabled: Boolean(id) })
  if (detail.isLoading) return <Card><div className="transaction-table-state">Loading transaction details…</div></Card>
  if (detail.isError || !detail.data) return <><Link className="text-link" to="/transactions"><ArrowLeft />Back to transactions</Link><Card><div className="notice error-notice"><CircleHelp />{detail.error?.message || 'Transaction not found.'}</div></Card></>
  const item = detail.data
  const forex = item.type === 'Forex Exchange'
  return <>
    <div className="page-header"><div><Link className="text-link" to="/transactions"><ArrowLeft />Back to transactions</Link><span className="eyebrow">{item.type}</span><h1>{item.reference}</h1><p>{item.description}</p></div><StatusBadge status={item.status} /></div>
    <div className="transaction-detail-layout">
      <Card className="transaction-detail-card"><div className="card-heading"><div><span className="eyebrow">Request details</span><h2>Transaction summary</h2></div></div><dl className="profile-facts">
        <div><dt>Request ID</dt><dd>{item.reference}</dd></div>
        <div><dt>Submitted</dt><dd>{displayDate(item.date)}</dd></div>
        <div><dt>Status</dt><dd>{item.status}</dd></div>
        <div><dt>Branch</dt><dd>{item.branch}</dd></div>
        {item.operational_reference && <div><dt>Completed reference</dt><dd>{item.operational_reference}</dd></div>}
        <div><dt>Completed on</dt><dd>{displayDate(item.completed_on)}</dd></div>
      </dl></Card>
      <Card className="transaction-detail-card"><div className="card-heading"><div><span className="eyebrow">{forex ? 'Exchange' : 'Transfer'} information</span><h2>{forex ? 'Currency details' : 'Recipient details'}</h2></div></div><dl className="profile-facts">
        {forex ? <>
          <div><dt>Request type</dt><dd>{item.request_type === 'BUY' ? 'Buy foreign currency' : 'Sell foreign currency'}</dd></div>
          <div><dt>Foreign amount</dt><dd>{item.foreign_currency} {Number(item.foreign_amount).toFixed(2)}</dd></div>
          <div><dt>Recorded rate</dt><dd>1 FJD = {Number(item.exchange_rate).toFixed(6)} {item.foreign_currency}</dd></div>
          <div><dt>Estimated FJD amount</dt><dd>{money(Number(item.estimated_fjd_amount))}</dd></div>
          <div><dt>Service fee</dt><dd>{money(Number(item.service_fee))}</dd></div>
          <div><dt>Estimated total</dt><dd>{money(Number(item.estimated_total))}</dd></div>
        </> : <>
          <div><dt>Destination</dt><dd>{item.destination_country}</dd></div>
          <div><dt>Receive currency</dt><dd>{item.receive_currency}</dd></div>
          <div><dt>Send amount</dt><dd>{money(Number(item.send_amount))}</dd></div>
          <div><dt>Recipient</dt><dd>{item.recipient_name}</dd></div>
          <div><dt>Relationship</dt><dd>{item.recipient_relationship}</dd></div>
          <div><dt>Purpose</dt><dd>{item.purpose}</dd></div>
          <div><dt>Source of funds</dt><dd>{item.source_of_funds}</dd></div>
        </>}
      </dl></Card>
      <Card className="transaction-receipt-card"><FileText /><div><span className="eyebrow">Request receipt</span><h2>Keep your request ID</h2><p>The receipt confirms submission only. It is not proof that the financial transaction has been completed.</p><ReceiptButtons transaction={item} /></div></Card>
    </div>
  </>
}
