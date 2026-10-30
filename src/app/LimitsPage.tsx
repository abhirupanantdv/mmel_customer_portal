import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, CircleHelp, FileCheck2, RefreshCw, ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, Progress } from '../components/ui'
import { limitsApi } from '../services/limits'

const money = (value: number) => `F$${value.toLocaleString('en-FJ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const periodLabel: Record<string, string> = {
  month: 'Per month',
  year: 'Per calendar year',
  trip: 'Per trip',
  invoice: 'Per invoice',
  application: 'Per application',
}

export function LimitsPage() {
  const query = useQuery({ queryKey: ['exchange-control-limits'], queryFn: limitsApi.getMyLimits })
  const [category, setCategory] = useState('All')
  const categories = useMemo(() => ['All', ...new Set(query.data?.rules.map(rule => rule.category) || [])], [query.data])
  const rules = query.data?.rules.filter(rule => category === 'All' || rule.category === category) || []

  if (query.isLoading) return <Card><div className="notice"><RefreshCw className="spin" />Loading your exchange-control limits…</div></Card>
  if (query.isError || !query.data) return <Card><div className="notice error-notice"><CircleHelp />{query.error?.message || 'Unable to load your limits.'}</div><Button variant="secondary" onClick={() => query.refetch()}><RefreshCw />Try again</Button></Card>

  const data = query.data
  const annualReset = `${new Date().getFullYear() + 1}-01-01`
  return <>
    <div className="page-header"><div><span className="eyebrow">Reserve Bank of Fiji · effective 1 January 2026</span><h1>My limits</h1><p>View applicable delegated limits and usage recorded by MH Money Express. Final eligibility remains subject to authorised-dealer checks.</p></div><Badge tone="success">Live ERPNext usage</Badge></div>

    <div className="limits-summary">
      <Card><ShieldCheck /><div><span>Policy status</span><strong>2026 guideline active</strong><small>Delegated limits, not automatic approvals</small></div></Card>
      <Card><CalendarDays /><div><span>Annual periods reset</span><strong>{annualReset}</strong><small>Trip, invoice and application rules do not use this reset</small></div></Card>
      <Card><FileCheck2 /><div><span>Recorded usage entries</span><strong>{data.ledger_entries}</strong><small>Only operator-linked ERPNext usage is counted</small></div></Card>
    </div>

    <div className="limits-toolbar" aria-label="Filter limits by category">
      {categories.map(item => <button key={item} className={item === category ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
    </div>

    <div className="limit-grid live-limits">
      {rules.map(rule => {
        const committed = rule.completed + rule.pending
        const utilisation = rule.cumulative ? Math.min((committed / rule.limit) * 100, 100) : 0
        return <Card key={rule.code}>
          <div className="limit-head"><div><span className="eyebrow">{rule.category}</span><h2>{rule.label}</h2></div><strong>{money(rule.limit)}</strong></div>
          <div className="limit-period"><span>{periodLabel[rule.period]}</span><span>{rule.basis}</span></div>
          {rule.cumulative ? <>
            <Progress value={utilisation} />
            <dl><div><dt>Completed usage</dt><dd>{money(rule.completed)}</dd></div><div><dt>Pending reservations</dt><dd>{money(rule.pending)}</dd></div><div className="available"><dt>Recorded availability</dt><dd>{money(rule.available || 0)}</dd></div></dl>
          </> : <div className="event-limit-note"><CheckCircle2 /><span>This limit is assessed separately for each {rule.period}. The ledger does not present a combined “available” balance.</span></div>}
          <details><summary>Documents and conditions</summary><ul>{rule.requirements.map(item => <li key={item}>{item}</li>)}{rule.notes.map(item => <li key={item}>{item}</li>)}</ul></details>
          <div className="rule-ref"><ShieldCheck />{rule.code} · Guideline page {rule.page} · {rule.record_count} matching record{rule.record_count === 1 ? '' : 's'}</div>
        </Card>
      })}
    </div>

    <Card className="compliance-note"><div><ShieldCheck /><div><strong>How these figures should be read</strong><p>{data.disclaimer} Usage shown here comes only from the dedicated ERPNext compliance ledger; legacy requests without an operator-linked rule are not silently inferred or counted.</p></div></div></Card>
  </>
}
