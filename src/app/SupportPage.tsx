import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { CircleHelp, Headphones, Mail, MessageSquareText, Phone, Plus, RefreshCw, Send } from 'lucide-react'
import { Button, Card, EmptyState, Field, Input } from '../components/ui'
import { StatusBadge } from '../components/StatusBadge'
import { supportApi } from '../services/support'

const questions = [
  ['How do I reserve foreign currency?', 'Open Foreign Exchange, choose Buy, select a currency and branch, get an estimate, and submit the request for operator review.'],
  ['What identification should I bring?', 'Bring a valid photo ID and any purpose-specific documents requested during operator review.'],
  ['How are transfer statuses updated?', 'Statuses are updated by authorised ERPNext operators as the request is reviewed and processed.'],
  ['When will a wallet credit appear?', 'A wallet credit appears only after an operator verifies settlement and posts the approved ERPNext journal entry.'],
  ['How do I report a lost card?', 'Raise a High-priority support ticket and include your membership-card number as the related reference.'],
]

export function SupportPage() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['support-home'], queryFn: supportApi.getSupportHome })
  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [reference, setReference] = useState('')
  const [created, setCreated] = useState('')
  const create = useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: ticket => {
      setCreated(ticket.name)
      setSubject('')
      setDescription('')
      setPriority('Medium')
      setReference('')
      setShowForm(false)
      void queryClient.invalidateQueries({ queryKey: ['support-home'] })
    },
  })

  if (query.isLoading) return <Card><div className="transaction-table-state"><RefreshCw className="spin" /> Loading help and support…</div></Card>
  if (query.isError || !query.data) return <Card><div className="notice error-notice"><CircleHelp />{query.error?.message || 'Support information is temporarily unavailable.'}</div><Button variant="secondary" onClick={() => query.refetch()}><RefreshCw />Try again</Button></Card>

  const { company, tickets, priorities } = query.data
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setCreated('')
    create.mutate({ subject, description, priority, related_reference: reference })
  }
  return <>
    <div className="page-header"><div><span className="eyebrow">We are here to help</span><h1>Help & support</h1><p>Contact {company.company_name} or raise a tracked ERPNext support ticket.</p></div><Button onClick={() => setShowForm(value => !value)}><MessageSquareText />{showForm ? 'Cancel ticket' : 'New support ticket'}</Button></div>
    {created && <div className="notice success-notice"><CircleHelp /><span>Ticket <strong>{created}</strong> was created in ERPNext. Its status will appear below.</span></div>}
    <div className="support-grid live-support-contacts">
      <Card><Headphones /><h3>Call customer service</h3><p>Speak with the support team using the telephone configured in ERPNext Company information.</p>{company.phone ? <a className="text-link" href={`tel:${company.phone.replace(/\s+/g, '')}`}><Phone />{company.phone}</a> : <span className="support-unavailable">Telephone not configured</span>}</Card>
      <Card><Mail /><h3>Email support</h3><p>Send non-urgent account and request questions to the configured company email.</p>{company.email ? <a className="text-link" href={`mailto:${company.email}`}><Mail />{company.email}</a> : <span className="support-unavailable">Email not configured</span>}</Card>
      <Card><MessageSquareText /><h3>Tracked support</h3><p>Every portal ticket is linked to your Customer record in the ERPNext Issue module.</p><Button variant="secondary" onClick={() => setShowForm(true)}>Raise a ticket</Button></Card>
    </div>
    {showForm && <Card className="support-ticket-form"><div className="card-heading"><div><span className="eyebrow">ERPNext Issue</span><h2>Create support ticket</h2></div></div><form className="quote-form" onSubmit={submit}><div className="form-row"><Field label="Subject"><Input value={subject} onChange={event => setSubject(event.target.value)} maxLength={140} placeholder="How can we help?" required /></Field><Field label="Priority"><select className="input" value={priority} onChange={event => setPriority(event.target.value)}>{priorities.map(item => <option key={item}>{item}</option>)}</select></Field></div><Field label="Related request or card number (optional)"><Input value={reference} onChange={event => setReference(event.target.value)} maxLength={140} placeholder="For example FXR-2026-00001" /></Field><Field label="Description"><textarea className="input" rows={5} value={description} onChange={event => setDescription(event.target.value)} maxLength={4000} placeholder="Describe the issue and what you need from the support team." required /></Field>{create.isError && <div className="notice error-notice"><CircleHelp />{create.error.message}</div>}<Button type="submit" disabled={create.isPending || subject.trim().length < 5 || description.trim().length < 10}><Send />{create.isPending ? 'Creating ticket…' : 'Submit ticket'}</Button></form></Card>}
    <div className="dashboard-grid support-ticket-layout">
      <Card><div className="card-heading"><div><span className="eyebrow">Common questions</span><h2>Frequently asked</h2></div></div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus /></summary><p>{answer}</p></details>)}</Card>
      <Card><div className="card-heading"><div><span className="eyebrow">ERPNext Issue history</span><h2>Your support tickets</h2></div></div>{tickets.length ? <div className="support-ticket-list">{tickets.map(ticket => <article key={ticket.name}><div><strong>{ticket.subject}</strong><span>{ticket.name} · {format(parseISO(ticket.modified), 'dd MMM yyyy, h:mm a')}</span></div><div><StatusBadge status={ticket.status} /><small>{ticket.priority}</small></div>{ticket.resolution && <p><strong>Resolution:</strong> {ticket.resolution}</p>}</article>)}</div> : <EmptyState icon={<CircleHelp />} title="No support tickets" body="Tickets raised from this portal will appear here with their ERPNext status and resolution." action={<Button onClick={() => setShowForm(true)}>Raise your first ticket</Button>} />}</Card>
    </div>
  </>
}
