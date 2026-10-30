import { useQuery } from '@tanstack/react-query'
import { format, parseISO, subDays } from 'date-fns'
import { BookOpenText, CircleHelp, Download, Printer, Repeat2, Send, WalletCards } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, EmptyState, Field, Input } from '../components/ui'
import { statementsApi, type StatementFormat, type StatementType } from '../services/statements'

const types = [
  { value: 'consolidated' as const, title: 'Consolidated statement', body: 'Forex, transfers and posted wallet activity', icon: BookOpenText },
  { value: 'forex' as const, title: 'Forex statement', body: 'Currency purchase and sale requests', icon: Repeat2 },
  { value: 'money_transfer' as const, title: 'Money transfer statement', body: 'International transfer requests', icon: Send },
  { value: 'wallet' as const, title: 'Wallet statement', body: 'Posted wallet ledger activity', icon: WalletCards },
]

const money = (amount: number, currency: string) => new Intl.NumberFormat('en-FJ', {
  style: 'currency', currency, currencyDisplay: currency === 'FJD' ? 'narrowSymbol' : 'code',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(amount).replace('$', currency === 'FJD' ? 'F$' : '$')

export function StatementsPage() {
  const [statementType, setStatementType] = useState<StatementType>('consolidated')
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fileFormat, setFileFormat] = useState<StatementFormat>('pdf')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const periodValid = Boolean(startDate && endDate && startDate <= endDate)
  const preview = useQuery({
    queryKey: ['statement-preview', statementType, startDate, endDate],
    queryFn: () => statementsApi.preview(statementType, startDate, endDate),
    enabled: periodValid,
  })
  const generate = async () => {
    setDownloading(true)
    setDownloadError('')
    try { await statementsApi.download(statementType, startDate, endDate, fileFormat) }
    catch (reason) { setDownloadError(reason instanceof Error ? reason.message : 'The statement could not be generated.') }
    finally { setDownloading(false) }
  }
  const totals = Object.entries(preview.data?.summary.totals ?? {})

  return <>
    <div className="page-header"><div><span className="eyebrow">ERPNext records</span><h1>Statements</h1><p>Generate customer-owned statements from live foreign exchange, money transfer and posted wallet records.</p></div></div>
    <div className="statement-grid live-statements">{types.map(({ value, title, body, icon: Icon }) => <button type="button" key={value} className={`card statement-type${statementType === value ? ' selected' : ''}`} onClick={() => setStatementType(value)} aria-pressed={statementType === value}><span><Icon /></span><div><h3>{title}</h3><p>{body}</p></div></button>)}</div>
    <Card className="statement-builder live-statement-builder">
      <div><span className="eyebrow">Create a report</span><h2>{types.find(item => item.value === statementType)?.title}</h2><p>Select a period of up to one year. PDF is suitable for printing; CSV can be opened in spreadsheet software.</p></div>
      <div className="form-row"><Field label="Start date"><Input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></Field><Field label="End date"><Input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></Field><Field label="Format"><select className="input" value={fileFormat} onChange={event => setFileFormat(event.target.value as StatementFormat)}><option value="pdf">PDF</option><option value="csv">CSV</option></select></Field></div>
      <div className="statement-generate-actions"><Button onClick={generate} disabled={!periodValid || downloading}>{downloading ? 'Generating…' : <><Download />Download {fileFormat.toUpperCase()}</>}</Button><Button variant="secondary" onClick={() => statementsApi.print(statementType, startDate, endDate)} disabled={!periodValid || fileFormat !== 'pdf'}><Printer />Print</Button></div>
    </Card>
    {!periodValid && <div className="notice error-notice"><CircleHelp />Select a valid start and end date.</div>}
    {downloadError && <div className="notice error-notice"><CircleHelp />{downloadError}</div>}
    {preview.isError && <div className="notice error-notice"><CircleHelp />{preview.error.message}</div>}
    <div className="statement-preview-grid">
      <Card><span>Records in period</span><strong>{preview.isLoading ? '…' : preview.data?.summary.records ?? 0}</strong></Card>
      <Card><span>Forex requests</span><strong>{preview.isLoading ? '…' : preview.data?.summary.by_type['Forex Exchange'] ?? 0}</strong></Card>
      <Card><span>Transfer requests</span><strong>{preview.isLoading ? '…' : preview.data?.summary.by_type['Money Transfer'] ?? 0}</strong></Card>
      <Card><span>Wallet entries</span><strong>{preview.isLoading ? '…' : preview.data?.summary.by_type.Wallet ?? 0}</strong></Card>
    </div>
    {!!totals.length && <Card className="statement-totals"><div className="card-heading"><div><span className="eyebrow">Recorded amounts</span><h2>Period totals</h2></div></div><div>{totals.map(([currency, values]) => <dl key={currency}><div><dt>{currency} credits</dt><dd>{money(values.credit, currency)}</dd></div><div><dt>{currency} debits</dt><dd>{money(values.debit, currency)}</dd></div></dl>)}</div><p>Request amounts reflect the values recorded at submission. Only posted wallet entries affect wallet balances.</p></Card>}
    {!preview.isLoading && preview.data && !preview.data.summary.records && <Card><EmptyState icon={<BookOpenText />} title="No records in this period" body="Choose another period or statement type. You can still download an empty statement for your records." /></Card>}
    {!!preview.data?.recent.length && <Card className="statement-recent"><div className="card-heading"><div><span className="eyebrow">Statement preview</span><h2>Latest records in the selected period</h2></div></div><div className="recent-list">{preview.data.recent.map(row => <div key={`${row.type}-${row.id}`}><span className={`transaction-icon ${row.direction}`}>{row.type === 'Forex Exchange' ? <Repeat2 /> : row.type === 'Money Transfer' ? <Send /> : <WalletCards />}</span><div><strong>{row.description}</strong><small>{row.reference} · {format(parseISO(row.date), 'dd MMM yyyy')}</small></div><div className="transaction-amount"><strong>{money(row.amount, row.currency)}</strong><small>{row.status}</small></div></div>)}</div></Card>}
  </>
}
