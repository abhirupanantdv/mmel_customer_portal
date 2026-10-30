import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Bell,
  Building2, CalendarDays, Camera, CheckCircle2, ChevronRight, Database as DatabaseIcon,
  CircleDollarSign, CircleHelp, Clock3, CreditCard, Download, FileCheck2,
  FileText, Fingerprint, Globe2, Headphones, Landmark, LockKeyhole, Mail,
  MapPin, MessageSquareText, Phone, Plus, Printer, QrCode,
  Repeat2, Send, ShieldCheck, Upload, UserRound, WalletCards,
} from 'lucide-react'
import { authApi } from '../services/auth'
import { forexApi, type ForexRequestRecord, type ForexRequestType, type LiveForexQuote } from '../services/forex'
import { moneyTransferApi, type TransferRequestRecord } from '../services/moneyTransfer'
import { membershipApi } from '../services/membership'
import { DEFAULT_DOCUMENT_CATEGORIES, profileApi, type ProfileUpdate } from '../services/profile'
import { chartData, transactions } from '../data/mock'
import { formatMoney } from '../utils/money'
import { Badge, Button, Card, EmptyState, Field, Input, Progress } from '../components/ui'
import { StatusBadge } from '../components/StatusBadge'
import { Logo } from '../components/Logo'
import { useSession } from '../stores/session'

const currency = (amount: string) => formatMoney(amount, 'FJD')
const fijiCurrency = (amount: number) => `F$${amount.toLocaleString('en-FJ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{action && <div>{action}</div>}</div>
}

const quoteSchema = z.object({
  requestType: z.enum(['BUY', 'SELL']),
  foreignCurrency: z.string().min(3, 'Select a currency'),
  foreignAmount: z.string().min(1, 'Enter an amount').refine(v => Number(v) > 0, 'Enter an amount above zero'),
  warehouse: z.string().min(1, 'Select an available branch'),
  customerNotes: z.string().max(500).optional(),
})
type QuoteForm = z.infer<typeof quoteSchema>

function RequestReceiptActions({
  requestId,
  onDownload,
  onPrint,
  compact = false,
}: {
  requestId: string
  onDownload: (requestId: string) => Promise<void>
  onPrint: (requestId: string) => void
  compact?: boolean
}) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setDownloading(true)
    setError('')
    try {
      await onDownload(requestId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The receipt could not be downloaded.')
    } finally {
      setDownloading(false)
    }
  }

  return <div className={`receipt-actions${compact ? ' compact' : ''}`}>
    <Button type="button" variant="secondary" onClick={() => onPrint(requestId)} aria-label={`Print receipt for request ${requestId}`}><Printer />Print{compact ? '' : ' receipt'}</Button>
    <Button type="button" variant="secondary" onClick={download} disabled={downloading} aria-label={`Download receipt for request ${requestId}`}><Download />{downloading ? 'Downloading…' : `Download${compact ? '' : ' receipt'}`}</Button>
    {error && <small className="receipt-error" role="alert">{error}</small>}
  </div>
}

export function ForexPage({ mode }: { mode?: 'buy' | 'sell' }) {
  const initialType: ForexRequestType = mode === 'sell' ? 'SELL' : 'BUY'
  const [quote, setQuote] = useState<LiveForexQuote | null>(null)
  const [submitted, setSubmitted] = useState<ForexRequestRecord | null>(null)
  const form = useForm<QuoteForm>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { requestType: initialType, foreignCurrency: '', foreignAmount: '', warehouse: '', customerNotes: '' },
  })
  const requestType = form.watch('requestType')
  const selectedCurrency = form.watch('foreignCurrency')
  const options = useQuery({ queryKey: ['forex-options', requestType], queryFn: () => forexApi.getOptions(requestType) })
  const history = useQuery({ queryKey: ['forex-requests'], queryFn: () => forexApi.listMyRequests(6) })
  const availableBranches = (options.data?.branches ?? []).filter(branch => !selectedCurrency || branch.currencies.includes(selectedCurrency))

  useEffect(() => {
    const nextType: ForexRequestType = mode === 'sell' ? 'SELL' : 'BUY'
    form.setValue('requestType', nextType)
    form.setValue('foreignCurrency', '')
    form.setValue('warehouse', '')
    setQuote(null)
    setSubmitted(null)
  }, [mode, form])

  const quoteMutation = useMutation({
    mutationFn: (values: QuoteForm) => forexApi.getQuote({
      request_type: values.requestType,
      currency: values.foreignCurrency,
      foreign_amount: values.foreignAmount,
      warehouse: values.warehouse,
    }),
    onSuccess: (result) => { setQuote(result); setSubmitted(null) },
  })
  const submitMutation = useMutation({
    mutationFn: (values: QuoteForm) => forexApi.createRequest({
      request_type: values.requestType,
      currency: values.foreignCurrency,
      foreign_amount: values.foreignAmount,
      warehouse: values.warehouse,
      customer_notes: values.customerNotes,
    }),
    onSuccess: (result) => { setSubmitted(result); setQuote(null); history.refetch() },
  })
  const selectRequestType = (type: ForexRequestType) => {
    form.setValue('requestType', type)
    form.setValue('foreignCurrency', '')
    form.setValue('warehouse', '')
    setQuote(null)
    setSubmitted(null)
  }
  const editQuote = () => { setQuote(null); setSubmitted(null) }
  const branch = options.data?.branches.find(item => item.value === form.watch('warehouse'))
  const action = requestType === 'BUY' ? 'buy' : 'sell'
  return <>
    <PageHeader eyebrow="Foreign exchange" title="Request a branch exchange" description="Use the live branch Item Price rate, choose where to complete the exchange, and send the request to an operator." />
    <div className="workflow-layout">
      <Card className="exchange-card">
        <div className="stepper"><span className="active">1</span><i /><span className={quote || submitted ? 'active' : ''}>2</span><i /><span className={submitted ? 'active' : ''}>3</span></div>
        <div className="card-heading"><div><span className="eyebrow">{submitted ? 'Request submitted' : quote ? 'Review live estimate' : 'Exchange details'}</span><h2>{submitted ? submitted.name : quote ? `Confirm your ${action} request` : 'Get the branch rate'}</h2></div>{submitted && <Badge tone="success">{submitted.status}</Badge>}</div>
        {!quote && !submitted && <form onSubmit={form.handleSubmit((values) => quoteMutation.mutate(values))} className="quote-form">
          <div className="trade-toggle"><label className={requestType === 'BUY' ? 'active' : ''}><input type="radio" checked={requestType === 'BUY'} onChange={() => selectRequestType('BUY')} />Buy foreign currency</label><label className={requestType === 'SELL' ? 'active' : ''}><input type="radio" checked={requestType === 'SELL'} onChange={() => selectRequestType('SELL')} />Sell foreign currency</label></div>
          <div className="form-row">
            <Field label="Foreign currency"><select className="input" {...form.register('foreignCurrency', { onChange: () => form.setValue('warehouse', '') })}><option value="">Select currency</option>{options.data?.currencies.map(code => <option key={code}>{code}</option>)}</select>{form.formState.errors.foreignCurrency && <small className="error">{form.formState.errors.foreignCurrency.message}</small>}</Field>
            <Field label="Foreign currency amount"><div className="amount-input"><span>{selectedCurrency || 'FX'}</span><Input inputMode="decimal" placeholder="0.00" {...form.register('foreignAmount')} /></div>{form.formState.errors.foreignAmount && <small className="error">{form.formState.errors.foreignAmount.message}</small>}</Field>
          </div>
          <Field label="Available branch"><select className="input" {...form.register('warehouse')} disabled={!selectedCurrency}><option value="">{selectedCurrency ? 'Select a branch' : 'Select currency first'}</option>{availableBranches.map(item => <option value={item.value} key={item.value}>{item.label}{item.city ? ` — ${item.city}` : ''}</option>)}</select>{form.formState.errors.warehouse && <small className="error">{form.formState.errors.warehouse.message}</small>}{branch && <small>{branch.address}{branch.phone ? ` · ${branch.phone}` : ''}</small>}</Field>
          <Field label="Notes for the operator (optional)"><textarea className="input" rows={3} placeholder="Preferred collection time or other details" {...form.register('customerNotes')} /></Field>
          {options.isLoading && <div className="notice"><Clock3 />Loading currencies and branches from ERPNext…</div>}
          {options.isError && <div className="notice error-notice"><CircleHelp />{options.error.message}</div>}
          {quoteMutation.isError && <div className="notice error-notice"><CircleHelp />{quoteMutation.error.message}</div>}
          <div className="notice"><ShieldCheck />The server reads the branch {requestType === 'BUY' ? 'Selling' : 'Buying'} Price List and derives the per-unit rate from its current Item Price denomination.</div>
          <Button type="submit" disabled={quoteMutation.isPending || options.isLoading}>{quoteMutation.isPending ? 'Retrieving live rate…' : 'Get Estimate'}<ArrowRight /></Button>
        </form>}
        {quote && <div className="quote-result">
          <div className="rate-hero"><span>Current branch rate</span><strong>1 FJD = {Number(quote.exchange_rate).toFixed(6)} {quote.foreign_currency}</strong><small>{branch?.label || quote.warehouse} · expires {format(parseISO(quote.quote_expires_on), 'dd MMM, h:mm a')}</small></div>
          <dl><div><dt>You {requestType === 'BUY' ? 'receive' : 'bring'}</dt><dd>{quote.foreign_currency} {Number(quote.foreign_amount).toFixed(2)}</dd></div><div><dt>Estimated FJD {requestType === 'BUY' ? 'payable' : 'receivable'}</dt><dd>{fijiCurrency(quote.estimated_fjd_amount)}</dd></div><div><dt>Service fee</dt><dd>{fijiCurrency(quote.service_fee)}</dd></div><div className="total"><dt>Estimated total</dt><dd>{fijiCurrency(quote.estimated_total)}</dd></div></dl>
          <div className="rate-source"><DatabaseIcon /><div><strong>Rate source: {quote.rate_price_list}</strong></div></div>
          <div className="notice"><ShieldCheck />This creates a request only. The outlet operator must verify KYC, limits, cash availability and the final rate before completing the actual transaction.</div>
          {submitMutation.isError && <div className="notice error-notice"><CircleHelp />{submitMutation.error.message}</div>}
          <div className="button-row"><Button variant="secondary" onClick={editQuote}>Edit details</Button><Button onClick={form.handleSubmit((values) => submitMutation.mutate(values))} disabled={submitMutation.isPending}>{submitMutation.isPending ? 'Submitting…' : 'Submit to branch'}<ArrowRight /></Button></div>
        </div>}
        {submitted && <div className="request-success"><CheckCircle2 /><h3>Your request is with the branch</h3><p>Reference <strong>{submitted.name}</strong> was sent to {branch?.label || submitted.warehouse}.</p><dl><div><dt>Status</dt><dd>{submitted.status}</dd></div><div><dt>Foreign amount</dt><dd>{submitted.foreign_currency} {Number(submitted.foreign_amount).toFixed(2)}</dd></div><div><dt>Estimated total</dt><dd>{fijiCurrency(submitted.estimated_total)}</dd></div></dl><RequestReceiptActions requestId={submitted.name} onDownload={forexApi.downloadReceipt} onPrint={forexApi.printReceipt} /><Button variant="secondary" onClick={() => { form.reset({ requestType, foreignCurrency: '', foreignAmount: '', warehouse: '', customerNotes: '' }); setSubmitted(null) }}>Create another request</Button></div>}
      </Card>
      <aside className="workflow-side"><Card><span className="eyebrow">Recent requests</span><h3>Operator status</h3>{history.isLoading && <p>Loading requests…</p>}{history.data?.length ? <div className="forex-request-list">{history.data.map(item => <div key={item.name}><div className="request-list-details"><div><strong>{item.foreign_currency} {Number(item.foreign_amount).toFixed(2)}</strong><span>{item.name} · {item.warehouse}</span></div><RequestReceiptActions compact requestId={item.name} onDownload={forexApi.downloadReceipt} onPrint={forexApi.printReceipt} /></div><StatusBadge status={item.status} /></div>)}</div> : !history.isLoading && <p>No forex requests submitted yet.</p>}</Card><Card><span className="eyebrow">How it works</span><h3>Branch-ready processing</h3><ul className="check-list"><li><CheckCircle2 />Rate comes from the selected branch Item Price</li><li><CheckCircle2 />Only branches offering the currency are shown</li><li><CheckCircle2 />The operator reviews the request in ERPNext</li><li><CheckCircle2 />The actual exchange remains operator-controlled</li></ul></Card><Card className="support-card"><Headphones /><div><strong>Need assistance?</strong><span>Our outlet team can help with your currency request.</span></div><Link to="/support">Get support</Link></Card></aside>
    </div>
  </>
}

const transferSchema = z.object({
  destinationKey: z.string().min(1, 'Select a destination country'),
  sendAmount: z.string().min(1, 'Enter an amount').refine(value => Number(value) > 0, 'Enter an amount above zero'),
  warehouse: z.string().min(1, 'Select an available branch'),
  recipientName: z.string().trim().min(2, 'Enter the recipient name'),
  recipientRelationship: z.string().trim().min(2, 'Enter the relationship'),
  purpose: z.string().trim().min(2, 'Enter the transfer purpose'),
  sourceOfFunds: z.string().trim().min(2, 'Enter the source of funds'),
  customerNotes: z.string().max(500).optional(),
})
type TransferForm = z.infer<typeof transferSchema>

export function MoneyTransferPage({ detail = false }: { detail?: boolean }) {
  const [reviewing, setReviewing] = useState(false)
  const [submitted, setSubmitted] = useState<TransferRequestRecord | null>(null)
  const form = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: { destinationKey: '', sendAmount: '', warehouse: '', recipientName: '', recipientRelationship: '', purpose: '', sourceOfFunds: '', customerNotes: '' },
  })
  const options = useQuery({ queryKey: ['money-transfer-options'], queryFn: moneyTransferApi.getOptions })
  const history = useQuery({ queryKey: ['money-transfer-requests'], queryFn: () => moneyTransferApi.listMyRequests(6) })
  const selectedDestination = options.data?.destinations.find(item => `${item.country}|||${item.currency}` === form.watch('destinationKey'))
  const selectedBranch = options.data?.branches.find(item => item.value === form.watch('warehouse'))
  const submit = useMutation({
    mutationFn: (values: TransferForm) => {
      const destination = options.data?.destinations.find(item => `${item.country}|||${item.currency}` === values.destinationKey)
      if (!destination) throw new Error('Select a valid destination country.')
      return moneyTransferApi.createRequest({
        destination_country: destination.country,
        receive_currency: destination.currency,
        send_amount: values.sendAmount,
        warehouse: values.warehouse,
        recipient_name: values.recipientName,
        recipient_relationship: values.recipientRelationship,
        purpose: values.purpose,
        source_of_funds: values.sourceOfFunds,
        customer_notes: values.customerNotes,
      })
    },
    onSuccess: (result) => { setSubmitted(result); setReviewing(false); history.refetch() },
  })
  const review = form.handleSubmit(() => { setReviewing(true); setSubmitted(null) })
  const reset = () => {
    form.reset()
    setReviewing(false)
    setSubmitted(null)
  }

  return <><PageHeader eyebrow="International transfers" title={detail ? 'Start a money transfer' : 'Send money across borders'} description="Choose a destination configured from ERPNext Items and submit the transfer request to your selected branch." />
    <div className="workflow-layout">
      <Card className="transfer-card">
        <div className="stepper"><span className="active">1</span><i /><span className={reviewing || submitted ? 'active' : ''}>2</span><i /><span className={submitted ? 'active' : ''}>3</span></div>
        <div className="card-heading"><div><span className="eyebrow">{submitted ? 'Request submitted' : reviewing ? 'Review request' : 'Transfer details'}</span><h2>{submitted ? submitted.name : reviewing ? 'Confirm your transfer request' : 'Tell us where you are sending'}</h2></div>{submitted && <Badge tone="success">{submitted.status}</Badge>}</div>

        {!reviewing && !submitted && <form className="quote-form" onSubmit={review}>
          <Field label="Destination country"><select className="input" {...form.register('destinationKey')}><option value="">Select destination</option>{options.data?.destinations.map(item => <option key={`${item.country}-${item.currency}`} value={`${item.country}|||${item.currency}`}>{item.country} — {item.currency}</option>)}</select>{form.formState.errors.destinationKey && <small className="error">{form.formState.errors.destinationKey.message}</small>}</Field>
          <div className="form-row"><Field label="You send"><div className="amount-input"><span>FJD</span><Input inputMode="decimal" placeholder="0.00" {...form.register('sendAmount')} /></div>{form.formState.errors.sendAmount && <small className="error">{form.formState.errors.sendAmount.message}</small>}</Field><Field label="Recipient currency"><div className="amount-input readonly"><span>{selectedDestination?.currency || 'FX'}</span><Input readOnly value="Confirmed by operator" /></div></Field></div>
          <Field label="Service branch"><select className="input" {...form.register('warehouse')}><option value="">Select a branch</option>{options.data?.branches.map(branch => <option value={branch.value} key={branch.value}>{branch.label}{branch.city ? ` — ${branch.city}` : ''}</option>)}</select>{form.formState.errors.warehouse && <small className="error">{form.formState.errors.warehouse.message}</small>}{selectedBranch && <small>{selectedBranch.address}{selectedBranch.phone ? ` · ${selectedBranch.phone}` : ''}</small>}</Field>
          <div className="form-row"><Field label="Recipient full name"><Input placeholder="As shown on identification" {...form.register('recipientName')} />{form.formState.errors.recipientName && <small className="error">{form.formState.errors.recipientName.message}</small>}</Field><Field label="Relationship to recipient"><Input placeholder="For example, family member" {...form.register('recipientRelationship')} />{form.formState.errors.recipientRelationship && <small className="error">{form.formState.errors.recipientRelationship.message}</small>}</Field></div>
          <div className="form-row"><Field label="Transfer purpose"><Input placeholder="Purpose of the transfer" {...form.register('purpose')} />{form.formState.errors.purpose && <small className="error">{form.formState.errors.purpose.message}</small>}</Field><Field label="Source of funds"><Input placeholder="Source of the funds" {...form.register('sourceOfFunds')} />{form.formState.errors.sourceOfFunds && <small className="error">{form.formState.errors.sourceOfFunds.message}</small>}</Field></div>
          <Field label="Notes for the operator (optional)"><textarea className="input" rows={3} {...form.register('customerNotes')} /></Field>
          {options.isLoading && <div className="notice"><Clock3 />Loading destinations and branches…</div>}
          {options.isError && <div className="notice error-notice"><CircleHelp />{options.error.message}</div>}
          <div className="notice"><ShieldCheck />The receiving amount, provider exchange rate, fee, KYC and compliance decision will be confirmed by the authorised operator.</div>
          <Button type="submit" className="w-full" disabled={options.isLoading}>Continue with Transfer Request<ArrowRight /></Button>
        </form>}

        {reviewing && !submitted && <div className="quote-result"><div className="rate-hero"><span>Destination</span><strong>{selectedDestination?.country}</strong><small>Recipient receives {selectedDestination?.currency} · service at {selectedBranch?.label}</small></div><dl><div><dt>You send</dt><dd>{fijiCurrency(Number(form.getValues('sendAmount')))}</dd></div><div><dt>Recipient</dt><dd>{form.getValues('recipientName')}</dd></div><div><dt>Relationship</dt><dd>{form.getValues('recipientRelationship')}</dd></div><div><dt>Purpose</dt><dd>{form.getValues('purpose')}</dd></div><div><dt>Source of funds</dt><dd>{form.getValues('sourceOfFunds')}</dd></div></dl><div className="notice"><ShieldCheck />Submitting this form creates an internal request only. It does not execute a MoneyGram transaction or issue a provider reference.</div>{submit.isError && <div className="notice error-notice"><CircleHelp />{submit.error.message}</div>}<div className="button-row"><Button variant="secondary" onClick={() => setReviewing(false)}>Edit details</Button><Button onClick={form.handleSubmit(values => submit.mutate(values))} disabled={submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit Transfer Request'}<ArrowRight /></Button></div></div>}

        {submitted && <div className="request-success"><CheckCircle2 /><h3>Your transfer request was submitted</h3><p>Reference <strong>{submitted.name}</strong> was sent to {selectedBranch?.label || submitted.warehouse}.</p><dl><div><dt>Status</dt><dd>{submitted.status}</dd></div><div><dt>Destination</dt><dd>{submitted.destination_country}</dd></div><div><dt>Send amount</dt><dd>{fijiCurrency(Number(submitted.send_amount))}</dd></div><div><dt>Recipient</dt><dd>{submitted.recipient_name}</dd></div></dl><RequestReceiptActions requestId={submitted.name} onDownload={moneyTransferApi.downloadReceipt} onPrint={moneyTransferApi.printReceipt} /><Button variant="secondary" onClick={reset}>Create another request</Button></div>}
      </Card>
      <aside className="workflow-side"><Card><span className="eyebrow">Recent requests</span><h3>Transfer status</h3>{history.isLoading && <p>Loading requests…</p>}{history.data?.length ? <div className="forex-request-list">{history.data.map(item => <div key={item.name}><div className="request-list-details"><div><strong>{fijiCurrency(Number(item.send_amount))} to {item.destination_country}</strong><span>{item.name} · {item.recipient_name}</span></div><RequestReceiptActions compact requestId={item.name} onDownload={moneyTransferApi.downloadReceipt} onPrint={moneyTransferApi.printReceipt} /></div><StatusBadge status={item.status} /></div>)}</div> : !history.isLoading && <p>No transfer requests submitted yet.</p>}</Card><Card><span className="eyebrow">Request workflow</span><h3>Operator-controlled transfer</h3><ul className="check-list"><li><CheckCircle2 />Countries come from enabled ERPNext Items</li><li><CheckCircle2 />Select the branch handling your request</li><li><CheckCircle2 />Operator verifies recipient and compliance details</li><li><CheckCircle2 />Provider reference appears only after confirmation</li></ul></Card><Card className="support-card"><Headphones /><div><strong>Need assistance?</strong><span>Our outlet team can help with your transfer request.</span></div><Link to="/support">Get support</Link></Card></aside>
    </div></>
}

export function WalletPage() {
  const cards = [{ label: 'Available', value: '2,450.00', icon: WalletCards },{ label: 'Pending', value: '150.00', icon: Clock3 },{ label: 'Reserved', value: '500.00', icon: LockKeyhole },{ label: 'Total', value: '3,100.00', icon: CircleDollarSign }]
  return <><PageHeader eyebrow="Backend-controlled ledger" title="My wallet" description="View illustrative balances, funding requests and wallet activity. No balance is authoritative in this demo." action={<Link className="btn btn-primary" to="/wallet/add-money"><Plus />Add money</Link>} /><div className="wallet-hero"><div><span>Available balance</span><strong>FJD 2,450.00</strong><small>Last backend sync: demo data</small></div><div className="wallet-hero-actions"><Link to="/wallet/transactions">View transactions</Link><Link to="/wallet/statement">Download statement</Link></div></div><div className="wallet-grid">{cards.map(({ icon: Icon, ...c }) => <Card key={c.label}><Icon /><span>{c.label} balance</span><strong>FJD {c.value}</strong></Card>)}</div><div className="dashboard-grid"><Card><div className="card-heading"><div><span className="eyebrow">Cash flow</span><h2>Wallet activity</h2></div><select className="small-select"><option>Last 6 months</option></select></div><div className="chart-wrap small"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Line dataKey="inflow" stroke="#0e9f6e" strokeWidth={3}/><Line dataKey="outflow" stroke="#c70d18" strokeWidth={3}/></LineChart></ResponsiveContainer></div></Card><Card><div className="card-heading"><div><span className="eyebrow">Recent ledger</span><h2>Latest wallet entries</h2></div><Link to="/wallet/transactions">View all</Link></div><div className="recent-list">{transactions.filter(t => t.type === 'Wallet' || t.type === 'Refund').map(t => <div key={t.id}><span className={`transaction-icon ${t.direction}`}>{t.direction === 'credit' ? <ArrowDownLeft/> : <ArrowUpRight/>}</span><div><strong>{t.description}</strong><small>{t.reference}</small></div><div className="transaction-amount"><strong>{currency(t.amount)}</strong><StatusBadge status={t.status}/></div></div>)}</div></Card></div></>
}

export function MembershipCardPage() {
  const [side, setSide] = useState<'both' | 'front'>('both')
  const cardQuery = useQuery({ queryKey: ['membership-card'], queryFn: membershipApi.getCard })
  const upload = useMutation({ mutationFn: membershipApi.uploadPhoto, onSuccess: () => cardQuery.refetch() })
  const download = useMutation({ mutationFn: ({ cardNumber }: { cardNumber: string }) => membershipApi.downloadPdf(cardNumber) })

  if (cardQuery.isLoading) return <Card><div className="notice"><Clock3 />Loading your membership record…</div></Card>
  if (cardQuery.isError || !cardQuery.data) return <Card><div className="notice error-notice"><CircleHelp />{cardQuery.error?.message || 'Unable to load your membership card.'}</div></Card>

  const card = cardQuery.data
  const initials = card.cardholder_name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  const photoUrl = card.photo_data_uri || ''
  const active = card.status === 'Active'
  const choosePhoto = (file?: File) => { if (file) upload.mutate(file) }

  return <><PageHeader eyebrow="Customer identification" title="My membership card" description="Your Customer and Supplier identities share the same ERPNext ID. The card becomes downloadable after operator approval." action={<StatusBadge status={card.status} />} /><div className="membership-layout"><Card className="card-preview"><div className="card-heading"><div><span className="eyebrow">Digital membership</span><h2>{card.card_number}</h2></div><div className="segmented"><button className={side === 'both' ? 'active' : ''} onClick={() => setSide('both')}>Front & back</button><button className={side === 'front' ? 'active' : ''} onClick={() => setSide('front')}>Front</button></div></div><div className={`membership-card-stack ${side === 'front' ? 'front-only' : ''}`}><div className="live-membership-card front"><span className="membership-card-sheen"/><img className="membership-card-logo" src="/assets/mh-money-express-logo.svg" alt="MH Money Express"/><strong className="membership-tagline">Your International Wallet</strong><div className="membership-card-number">{card.card_number}</div><div className="membership-card-customer"><small>CUSTOMER ID</small><strong>{card.customer_id}</strong></div><div className="membership-card-name"><small>MEMBER NAME</small><strong>{card.cardholder_name}</strong></div><div className="membership-card-valid"><small>VALID THRU</small><strong>{card.valid_until ? format(parseISO(card.valid_until), 'MM/yyyy') : 'PENDING'}</strong></div><div className="membership-card-photo">{photoUrl ? <img src={photoUrl} alt={`${card.cardholder_name} membership photograph`}/> : <span><Camera/>Photo required</span>}</div><span className="membership-card-state">{card.status}</span>{!active && <div className="membership-card-lock"><Clock3/><strong>Awaiting operator approval</strong></div>}</div>{side === 'both' && <div className="live-membership-card back"><div className="membership-card-strip"/><img className="membership-card-back-logo" src="/assets/mh-money-express-logo.svg" alt=""/><div className="membership-card-services"><span>Currency exchange</span><span>Money transfer</span><span>Member services</span></div><div className="membership-card-notice"><strong>Important information</strong><p>This membership card is valid only while its ERPNext status is Active. Final transactions remain subject to identification, KYC and compliance checks.</p></div><div className="membership-card-contact"><strong>MH Money Express</strong><span>moneygram.advtinni.com</span></div></div>}</div><div className="card-actions">{active ? <><Button onClick={() => download.mutate({ cardNumber: card.card_number })} disabled={download.isPending}><Download />{download.isPending ? 'Preparing PDF…' : 'Download PDF'}</Button><Button variant="secondary" onClick={membershipApi.printPdf}><Printer />Print card</Button></> : <><label className="btn btn-secondary membership-upload-button"><Camera />{card.has_photo ? 'Replace photo' : 'Capture or upload photo'}<input type="file" accept="image/png,image/jpeg" capture="user" onChange={event => choosePhoto(event.target.files?.[0])}/></label><Button disabled><Download />Available after approval</Button></>}{upload.isPending && <span className="action-note">Uploading securely…</span>}</div>{(upload.isError || download.isError) && <div className="notice error-notice"><CircleHelp />{upload.error?.message || download.error?.message}</div>}</Card><aside className="membership-side"><Card><div className="profile-line"><div className="avatar large">{initials}</div><div><strong>{card.cardholder_name}</strong><span>Customer & Supplier ID {card.customer_id}</span></div><StatusBadge status={card.profile_review_status} /></div><dl className="profile-facts"><div><dt>Membership card number</dt><dd>{card.card_number}</dd></div><div><dt>Customer ID</dt><dd>{card.customer_id}</dd></div><div><dt>Supplier ID</dt><dd>{card.supplier_id}</dd></div><div><dt>Issued on</dt><dd>{card.issued_on ? format(parseISO(card.issued_on), 'dd MMMM yyyy') : 'After approval'}</dd></div><div><dt>Valid until</dt><dd>{card.valid_until ? format(parseISO(card.valid_until), 'dd MMMM yyyy') : 'After approval'}</dd></div></dl></Card><Card><div className="card-heading"><div><span className="eyebrow">Approval workflow</span><h2>{active ? 'Membership active' : 'Verification in progress'}</h2></div></div><div className="membership-approval-steps"><div className={card.profile_review_status === 'Approved' ? 'complete' : ''}><span>{card.profile_review_status === 'Approved' ? <CheckCircle2/> : <Clock3/>}</span><div><strong>Profile and KYC</strong><small>{card.profile_review_status}</small></div></div><div className={card.card_review_status === 'Approved' ? 'complete' : ''}><span>{card.card_review_status === 'Approved' ? <CheckCircle2/> : <Clock3/>}</span><div><strong>Membership card</strong><small>{card.card_review_status}</small></div></div></div>{!card.has_photo && <p className="membership-guidance">Capture or upload a clear front-facing photograph. Then submit identity and address documents under Profile & KYC.</p>}{card.status === 'Rejected' && card.operator_remarks && <div className="notice error-notice"><CircleHelp />{card.operator_remarks}</div>}<Link className="btn btn-secondary w-full" to="/profile/kyc"><FileCheck2/>Open Profile & KYC</Link></Card><Card><div className="qr-safe"><QrCode /><div><strong>Operator-controlled activation</strong><span>ERPNext staff verify the supporting evidence, approve the profile, and then approve the card. Download and print remain locked until both approvals are complete.</span></div></div></Card></aside></div></>
}

export function ProfilePage({ kyc = false }: { kyc?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('PROOF_OF_IDENTITY')
  const [uploadName, setUploadName] = useState('PASSPORT')
  const [documentNumber, setDocumentNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState('')
  const query = useQuery({ queryKey: ['customer-profile'], queryFn: profileApi.getProfile })
  const profileResponse = query.data
  const profile = profileResponse ? {
    ...profileResponse,
    document_categories: profileResponse.document_categories?.length ? profileResponse.document_categories : DEFAULT_DOCUMENT_CATEGORIES,
  } : undefined
  const form = useForm<ProfileUpdate>({
    values: profile ? {
      full_name: profile.full_name, mobile: profile.mobile || '', date_of_birth: profile.date_of_birth || '',
      country: profile.country || 'Fiji', city: profile.city || '', occupation: profile.occupation || '',
      address_line1: profile.address.address_line1, address_line2: profile.address.address_line2,
      state: profile.address.state, postal_code: profile.address.postal_code,
    } : { full_name: '', mobile: '', date_of_birth: '', country: 'Fiji', city: '', occupation: '', address_line1: '', address_line2: '', state: '', postal_code: '' },
  })
  const update = useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: (data) => { query.refetch(); useSession.setState({ customer: { user: data.email, customer_id: data.customer_id, full_name: data.full_name, email: data.email, mobile: data.mobile, date_of_birth: data.date_of_birth, country: data.country } }); setEditing(false) },
  })
  const upload = useMutation({
    mutationFn: profileApi.uploadDocument,
    onSuccess: () => { query.refetch(); setShowUpload(false); setUploadFile(null); setDocumentNumber(''); setExpiryDate('') },
  })

  useEffect(() => {
    if (!uploadFile) {
      setFilePreviewUrl('')
      return
    }
    const previewUrl = URL.createObjectURL(uploadFile)
    setFilePreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [uploadFile])

  if (query.isPending) return <Card><p>Loading your ERPNext customer profile…</p></Card>
  if (query.isError || !profile) return <Card><EmptyState icon={<CircleHelp/>} title="Profile unavailable" body={query.error instanceof Error ? query.error.message : 'Unable to load the customer profile.'} action={<Button onClick={() => query.refetch()}>Try again</Button>}/></Card>

  const initials = profile.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  const residentialAddress = [profile.address.address_line1, profile.address.address_line2, profile.address.city, profile.address.state, profile.address.country].filter(Boolean).join(', ') || 'Not provided'
  const statusTone = (status: string) => status === 'Verified' ? 'success' as const : status === 'Rejected' || status === 'Expired' ? 'danger' as const : 'warning' as const
  const friendlyDocumentStatus = (status: string, expired: boolean) => expired ? 'Expired' : status === 'Draft' ? 'Under Review' : status
  const documentCategories = profile.document_categories
  const selectedCategory = documentCategories.find((category) => category.value === uploadCategory) || documentCategories[0]
  const documentOptions = selectedCategory?.documents || []
  const selectCategory = (categoryValue: string) => {
    const category = documentCategories.find((option) => option.value === categoryValue)
    setUploadCategory(categoryValue)
    setUploadName(category?.documents[0]?.value || '')
  }

  return <><PageHeader eyebrow="Customer identity" title={kyc ? 'KYC & documents' : 'Profile'} description={kyc ? 'Review verification status and submit supporting documents securely to ERPNext.' : 'Keep your ERPNext customer information up to date.'} action={!kyc && <Button variant="secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel editing' : 'Edit details'}</Button>} /><div className="profile-layout"><aside><Card className="identity-card"><div className="avatar xlarge">{initials}<button aria-label="Upload customer photograph" onClick={() => { setUploadCategory('PHOTO'); setUploadName('CUSTOMER_PHOTO'); setShowUpload(true) }}><Camera /></button></div><h2>{profile.full_name}</h2><span>{profile.customer_id}</span><StatusBadge status={profile.kyc_status.overall}/><div className="completion"><span>Profile completeness <strong>{profile.profile_completion}%</strong></span><Progress value={profile.profile_completion}/></div></Card><nav className="profile-nav"><Link className={!kyc ? 'active' : ''} to="/profile"><UserRound/>Personal information</Link><Link className={kyc ? 'active' : ''} to="/profile/kyc"><Fingerprint/>KYC & documents</Link><Link to="/settings"><LockKeyhole/>Security settings</Link></nav></aside><div>{kyc ? <><Card><div className="card-heading"><div><span className="eyebrow">Verification status</span><h2>{profile.kyc_status.overall === 'Verified' ? 'Identity verified' : 'Verification incomplete'}</h2></div><Badge tone={statusTone(profile.kyc_status.overall)}><BadgeCheck/>{profile.kyc_status.overall}</Badge></div><div className="kyc-status"><div><CheckCircle2/><span>Identity document</span><strong>{profile.kyc_status.identity}</strong></div><div><CheckCircle2/><span>Residential address</span><strong>{profile.kyc_status.address}</strong></div><div><CheckCircle2/><span>Customer photograph</span><strong>{profile.kyc_status.photo}</strong></div></div></Card><Card><div className="card-heading"><div><span className="eyebrow">Secure files</span><h2>Documents</h2></div><Button variant="secondary" onClick={() => { setShowUpload((value) => !value); if (showUpload) setUploadFile(null) }}><Upload/>{showUpload ? 'Cancel upload' : 'Upload document'}</Button></div>{showUpload && <form className="kyc-upload-form" onSubmit={(event) => { event.preventDefault(); if (uploadFile) upload.mutate({ document_category: uploadCategory, document_name: uploadName, document_number: documentNumber, expiry_date: expiryDate || undefined, file: uploadFile }) }}><div className="form-row"><Field label="Document type"><select className="input" value={uploadCategory} onChange={(event) => selectCategory(event.target.value)}>{profile.document_categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></Field><Field label="Document name"><select className="input" value={uploadName} onChange={(event) => setUploadName(event.target.value)}>{documentOptions.map((document) => <option key={document.value} value={document.value}>{document.label}</option>)}</select></Field></div><div className="form-row"><Field label="Document number (optional)"><Input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)}/></Field><Field label="Expiry date (optional)"><Input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)}/></Field></div><Field label="File"><Input type="file" accept={uploadCategory === 'PHOTO' ? '.png,.jpg,.jpeg' : '.pdf,.png,.jpg,.jpeg'} onChange={(event) => setUploadFile(event.target.files?.[0] || null)}/></Field>{uploadFile && filePreviewUrl && <section className="kyc-file-preview" aria-label="Selected file preview"><div className="kyc-preview-head"><div><FileText/><span><strong>{uploadFile.name}</strong><small>{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</small></span></div><button type="button" onClick={() => setUploadFile(null)}>Remove</button></div>{uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf') ? <object data={filePreviewUrl} type="application/pdf" aria-label={`${uploadFile.name} preview`}><a href={filePreviewUrl} target="_blank" rel="noreferrer">Open PDF preview</a></object> : <img src={filePreviewUrl} alt={`${uploadFile.name} preview`}/>}</section>}{upload.isError && <div className="form-error" role="alert">{upload.error instanceof Error ? upload.error.message : 'Upload failed.'}</div>}<Button type="submit" disabled={!uploadFile || !uploadName || upload.isPending}>{upload.isPending ? 'Uploading securely…' : 'Submit for verification'}</Button><small>PDF, PNG, JPG or JPEG · maximum 10 MB. New documents remain under review until verified by authorised staff.</small></form>}{profile.documents.length ? profile.documents.map((document) => { const documentStatus = friendlyDocumentStatus(document.status, document.expired); return <div className="document-row" key={document.name}><FileText/><div><strong>{document.document_name || document.label}</strong><span>{document.category_label} · {document.expiry_date ? `Expires ${format(parseISO(document.expiry_date), 'dd MMM yyyy')}` : `Uploaded ${format(parseISO(document.creation), 'dd MMM yyyy')}`}</span></div><Badge tone={statusTone(documentStatus)}>{documentStatus}</Badge></div> }) : <EmptyState icon={<FileText/>} title="No KYC documents submitted" body="Upload an identity document, proof of address, and customer photograph to begin verification." action={<Button onClick={() => setShowUpload(true)}>Upload first document</Button>}/>}</Card></> : editing ? <Card><form className="profile-edit-form" onSubmit={form.handleSubmit((values) => update.mutate(values))}><div className="card-heading"><div><span className="eyebrow">ERPNext customer profile</span><h2>Edit customer details</h2></div></div><div className="form-row"><Field label="Full legal name"><Input {...form.register('full_name')} required/></Field><Field label="Date of birth"><Input type="date" {...form.register('date_of_birth')}/></Field></div><div className="form-row"><Field label="Mobile"><Input type="tel" {...form.register('mobile')} required/></Field><Field label="Occupation"><Input {...form.register('occupation')}/></Field></div><div className="form-row"><Field label="Address line 1"><Input {...form.register('address_line1')} /></Field><Field label="Address line 2"><Input {...form.register('address_line2')} /></Field></div><div className="form-row"><Field label="City"><Input {...form.register('city')} /></Field><Field label="State / province"><Input {...form.register('state')} /></Field></div><div className="form-row"><Field label="Postal code"><Input {...form.register('postal_code')} /></Field><Field label="Country"><Input {...form.register('country')} required/></Field></div>{update.isError && <div className="form-error" role="alert">{update.error instanceof Error ? update.error.message : 'Unable to update your profile.'}</div>}<Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving to ERPNext…' : 'Save profile'}</Button></form></Card> : <><Card><div className="card-heading"><div><span className="eyebrow">Personal information</span><h2>Customer details</h2></div></div><div className="details-grid"><Detail label="Full legal name" value={profile.full_name}/><Detail label="Date of birth" value={profile.date_of_birth ? format(parseISO(profile.date_of_birth), 'dd MMMM yyyy') : 'Not provided'}/><Detail label="Country" value={profile.country || 'Not provided'}/><Detail label="Occupation" value={profile.occupation || 'Not provided'}/><Detail label="Customer ID" value={profile.customer_id}/><Detail label="Account status" value={profile.account_status}/></div></Card><Card><div className="card-heading"><div><span className="eyebrow">Contact information</span><h2>How we reach you</h2></div></div><div className="details-grid"><Detail label="Mobile" value={profile.mobile || 'Not provided'}/><Detail label="Email" value={profile.email}/><Detail label="Residential address" value={residentialAddress}/><Detail label="Country of residence" value={profile.address.country || profile.country || 'Not provided'}/></div></Card></>}</div></div></>
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="detail"><span>{label}</span><strong>{value}</strong></div> }

export function ActivityPage() {
  return <><PageHeader eyebrow="Analytics" title="My financial activity" description="Explore illustrative transaction patterns across forex, transfers and wallet activity." action={<select className="small-select"><option>Last 6 months</option><option>This year</option><option>Custom range</option></select>} /><div className="analytics-grid"><Card className="wide"><div className="card-heading"><div><span className="eyebrow">Monthly volume</span><h2>Forex and transfers</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month"/><YAxis/><Tooltip/><Area dataKey="forex" stroke="#c70d18" fill="#c70d1822"/><Area dataKey="transfers" stroke="#252a31" fill="#252a3118"/></AreaChart></ResponsiveContainer></div></Card><Card><div className="card-heading"><div><span className="eyebrow">Top currencies</span><h2>Currency mix</h2></div></div><div className="currency-list"><div><span>USD</span><Progress value={72}/><strong>72%</strong></div><div><span>AUD</span><Progress value={44}/><strong>44%</strong></div><div><span>NZD</span><Progress value={29}/><strong>29%</strong></div></div></Card><Card><div className="card-heading"><div><span className="eyebrow">Purpose</span><h2>Usage by purpose</h2></div></div><div className="purpose-list"><span><i className="red"/>Travel<strong>48%</strong></span><span><i className="black"/>Family support<strong>31%</strong></span><span><i className="gold"/>Education<strong>21%</strong></span></div></Card></div></>
}

export function BranchesPage({ appointments = false }: { appointments?: boolean }) {
  const branches = [{name:'Suva Central',address:'Victoria Parade, Suva',phone:'+679 331 4455',hours:'Mon–Fri · 8:30am–5:00pm'},{name:'Nadi Town',address:'Main Street, Nadi',phone:'+679 670 1188',hours:'Mon–Sat · 9:00am–5:00pm'},{name:'Lautoka City',address:'Vitogo Parade, Lautoka',phone:'+679 666 2030',hours:'Mon–Fri · 8:30am–5:00pm'}]
  return <><PageHeader eyebrow="Outlet services" title={appointments ? 'Book an appointment' : 'Find a branch'} description={appointments ? 'Choose an outlet, service and backend-confirmed time slot.' : 'Find MH services, contact details and illustrative opening hours.'} /><div className="branch-layout"><div className="branch-list">{branches.map((b,i) => <Card key={b.name} className={i===0?'selected':''}><div className="branch-marker"><MapPin/></div><div><h3>{b.name}</h3><p>{b.address}</p><span><Clock3/>{b.hours}</span><span><Phone/>{b.phone}</span></div><Link to="/appointments">{appointments?'Select':'Book'}<ChevronRight/></Link></Card>)}</div><Card className="map-placeholder"><Globe2/><h3>Branch map</h3><p>Map integration will be enabled after an approved provider and branch API are configured.</p><Badge tone="warning">Integration pending</Badge></Card></div></>
}

export function SettingsPage() {
  return <><PageHeader eyebrow="Account protection" title="Settings" description="Manage security, notifications and session preferences." /><div className="settings-grid"><Card><div className="setting-icon"><LockKeyhole/></div><div><h3>Password & authentication</h3><p>Manage your password and configure MFA for sensitive actions.</p></div><Button variant="secondary">Manage</Button></Card><Card><div className="setting-icon"><Bell/></div><div><h3>Notification preferences</h3><p>Choose approved email, SMS and in-app alert types.</p></div><Button variant="secondary">Manage</Button></Card><Card><div className="setting-icon"><Fingerprint/></div><div><h3>Sessions & devices</h3><p>Review active sessions and securely sign out other devices.</p></div><Button variant="secondary">Review</Button></Card></div></>
}

export function PlaceholderPage({ title, description, icon: Icon = FileCheck2 }: { title: string; description: string; icon?: typeof FileCheck2 }) {
  return <><PageHeader eyebrow="Demo workflow" title={title} description={description} /><Card><EmptyState icon={<Icon/>} title={`${title} is integration-ready`} body="The route, responsive shell and mock service boundary are in place. Production actions remain unavailable until the corresponding approved backend capability is configured." action={<Link className="btn btn-secondary" to="/dashboard">Return to dashboard</Link>} /></Card></>
}

const authSchema = z.object({ email: z.string().email('Enter a valid email address'), password: z.string().min(8, 'Use at least 8 characters') })
export function LoginPage() {
  const navigate = useNavigate(); const signIn = useSession(s => s.signIn)
  const form = useForm<z.infer<typeof authSchema>>({ resolver: zodResolver(authSchema), defaultValues: { email: '', password: '' } })
  const submit = async (values: z.infer<typeof authSchema>) => {
    try { await signIn(values.email, values.password); navigate('/dashboard') }
    catch (error) { form.setError('root', { message: error instanceof Error ? error.message : 'Unable to sign in.' }) }
  }
  return <div className="auth-page"><section className="auth-brand"><Logo/><div className="auth-copy"><span className="eyebrow">Your international wallet</span><h1>Your money, transfers and currency — all in one place.</h1><p>A secure customer portal for MH foreign exchange, transfer services, membership and support.</p><div className="auth-points"><span><ShieldCheck/>Secure customer access</span><span><Globe2/>International services</span><span><Landmark/>Branch-connected support</span></div></div><small>Secure access powered by MH MoneyGram ERPNext.</small></section><main className="auth-panel"><div className="mobile-auth-logo"><Logo hideLabel/></div><form onSubmit={form.handleSubmit(submit)}><span className="eyebrow">Welcome back</span><h2>Sign in to your account</h2><p>Use the email address and password registered with MH MoneyGram.</p>{form.formState.errors.root && <div className="form-error" role="alert">{form.formState.errors.root.message}</div>}<Field label="Email address"><Input type="email" autoComplete="email" {...form.register('email')}/>{form.formState.errors.email && <small className="error">{form.formState.errors.email.message}</small>}</Field><Field label="Password"><Input type="password" autoComplete="current-password" {...form.register('password')}/>{form.formState.errors.password && <small className="error">{form.formState.errors.password.message}</small>}</Field><div className="form-meta"><label><input type="checkbox"/>Remember this device</label><Link to="/forgot-password">Forgot password?</Link></div><Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}<ArrowRight/></Button><p className="auth-bottom">New customer? <Link to="/register">Create an account</Link></p></form></main></div>
}

const registerSchema = z.object({
  fullName: z.string().min(2, 'Enter your full legal name'),
  dateOfBirth: z.string().min(1, 'Enter your date of birth'),
  mobile: z.string().min(7, 'Enter a valid mobile number'),
  email: z.string().email('Enter a valid email address'),
  country: z.string().min(1),
  password: z.string().min(8, 'Use at least 8 characters'),
  confirmPassword: z.string(),
  consent: z.boolean().refine((value) => value, 'You must accept the terms and privacy notice'),
}).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export function RegisterPage() {
  const navigate = useNavigate(); const signIn = useSession(s => s.signIn)
  const form = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { fullName: '', dateOfBirth: '', mobile: '+679', email: '', country: 'Fiji', password: '', confirmPassword: '', consent: false } })
  const submit = async (values: z.infer<typeof registerSchema>) => {
    try {
      await authApi.signUp({ full_name: values.fullName, date_of_birth: values.dateOfBirth, mobile: values.mobile, email: values.email, country: values.country, password: values.password, consent: values.consent })
      await signIn(values.email, values.password)
      navigate('/dashboard')
    } catch (error) { form.setError('root', { message: error instanceof Error ? error.message : 'Unable to create your account.' }) }
  }
  return <div className="auth-page"><section className="auth-brand"><Logo/><div className="auth-copy"><span className="eyebrow">Customer registration</span><h1>Start your MH customer journey.</h1><p>Registration creates your secure ERPNext customer profile. Identity and compliance verification follow in the portal.</p></div></section><main className="auth-panel register-panel"><form onSubmit={form.handleSubmit(submit)}><span className="eyebrow">Secure registration</span><h2>Create your customer profile</h2><p>Use your legal details exactly as they appear on your identification.</p>{form.formState.errors.root && <div className="form-error" role="alert">{form.formState.errors.root.message}</div>}<div className="form-row"><Field label="Full legal name"><Input placeholder="As shown on your ID" autoComplete="name" {...form.register('fullName')}/>{form.formState.errors.fullName && <small className="error">{form.formState.errors.fullName.message}</small>}</Field><Field label="Date of birth"><Input type="date" {...form.register('dateOfBirth')}/>{form.formState.errors.dateOfBirth && <small className="error">{form.formState.errors.dateOfBirth.message}</small>}</Field></div><div className="form-row"><Field label="Mobile number"><Input type="tel" autoComplete="tel" {...form.register('mobile')}/>{form.formState.errors.mobile && <small className="error">{form.formState.errors.mobile.message}</small>}</Field><Field label="Email address"><Input type="email" autoComplete="email" {...form.register('email')}/>{form.formState.errors.email && <small className="error">{form.formState.errors.email.message}</small>}</Field></div><Field label="Country of residence"><select className="input" {...form.register('country')}><option>Fiji</option><option>Other</option></select></Field><div className="form-row"><Field label="Password"><Input type="password" autoComplete="new-password" {...form.register('password')}/>{form.formState.errors.password && <small className="error">{form.formState.errors.password.message}</small>}</Field><Field label="Confirm password"><Input type="password" autoComplete="new-password" {...form.register('confirmPassword')}/>{form.formState.errors.confirmPassword && <small className="error">{form.formState.errors.confirmPassword.message}</small>}</Field></div><label className="consent"><input type="checkbox" {...form.register('consent')}/>I consent to the secure processing of my information and accept the terms and privacy notice.</label>{form.formState.errors.consent && <small className="error">{form.formState.errors.consent.message}</small>}<Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Creating account…' : 'Create account'}<ArrowRight/></Button><p className="auth-bottom">Already registered? <Link to="/login">Sign in</Link></p></form></main></div>
}

export function ForgotPasswordPage() {
  return <div className="centered-auth"><Logo/><Card><LockKeyhole/><h1>Reset your password</h1><p>Enter your registered email. A production system would send an approved, time-limited reset link.</p><Field label="Email address"><Input type="email" placeholder="you@example.com"/></Field><Button className="w-full">Send demo reset link</Button><Link to="/login">Back to sign in</Link></Card></div>
}

export function NotFoundPage() { return <div className="not-found"><strong>404</strong><h1>Page not found</h1><p>The page you requested is not available.</p><Link className="btn btn-primary" to="/dashboard">Go to dashboard</Link></div> }
