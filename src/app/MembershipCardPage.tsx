import { useMutation, useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Camera, CheckCircle2, CircleHelp, Clock3, Download, FileCheck2, Printer, QrCode } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import { Button, Card } from '../components/ui'
import { membershipApi } from '../services/membership'

function formatCardNumber(value: string) {
  return value.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function websiteUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export function MembershipCardPage() {
  const [side, setSide] = useState<'both' | 'front'>('both')
  const cardQuery = useQuery({ queryKey: ['membership-card'], queryFn: membershipApi.getCard })
  const upload = useMutation({ mutationFn: membershipApi.uploadPhoto, onSuccess: () => cardQuery.refetch() })
  const download = useMutation({ mutationFn: ({ cardNumber }: { cardNumber: string }) => membershipApi.downloadPdf(cardNumber) })

  if (cardQuery.isLoading) return <Card><div className="notice"><Clock3 />Loading your membership record…</div></Card>
  if (cardQuery.isError || !cardQuery.data) return <Card><div className="notice error-notice"><CircleHelp />{cardQuery.error?.message || 'Unable to load your membership card.'}</div></Card>

  const card = cardQuery.data
  const formattedNumber = formatCardNumber(card.card_number)
  const initials = card.cardholder_name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  const active = card.status === 'Active'
  const choosePhoto = (file?: File) => { if (file) upload.mutate(file) }

  return <>
    <div className="page-header">
      <div><span className="eyebrow">Customer identification</span><h1>My membership card</h1><p>Your Customer and Supplier identities share the same ERPNext ID. The card becomes downloadable after operator approval.</p></div>
      <StatusBadge status={card.status} />
    </div>
    <div className="membership-layout">
      <Card className="card-preview">
        <div className="card-heading">
          <div><span className="eyebrow">Digital membership</span><h2>{formattedNumber}</h2></div>
          <div className="segmented"><button className={side === 'both' ? 'active' : ''} onClick={() => setSide('both')}>Front &amp; back</button><button className={side === 'front' ? 'active' : ''} onClick={() => setSide('front')}>Front</button></div>
        </div>
        <div className={`membership-card-stack ${side === 'front' ? 'front-only' : ''}`}>
          <div className="live-membership-card front">
            <div className="membership-card-number">{formattedNumber}</div>
            <div className="membership-card-name"><small>CUSTOMER NAME</small><strong>{card.cardholder_name}</strong></div>
            <div className="membership-card-customer"><small>CUSTOMER ID</small><strong>{card.customer_id}</strong></div>
            <div className="membership-card-valid"><small>VALID THRU</small><strong>{card.valid_until ? format(parseISO(card.valid_until), 'MM/yyyy') : 'PENDING'}</strong></div>
            <div className="membership-card-photo">{card.photo_data_uri ? <img src={card.photo_data_uri} alt={`${card.cardholder_name} membership photograph`} /> : <span><Camera />Photo required</span>}</div>
            {card.qr_data_uri && <><a className="membership-card-qr" href={card.verification_url} target="_blank" rel="noreferrer" aria-label="Verify membership card"><img src={card.qr_data_uri} alt="Membership verification QR code" /></a><span className="membership-card-qr-label">SCAN FOR SERVICES</span></>}
            {!active && <div className="membership-card-lock"><Clock3 /><strong>Awaiting operator approval</strong></div>}
          </div>
          {side === 'both' && <div className="live-membership-card back"><div className="membership-card-company-contact"><strong>{card.company_contact.company_name}</strong>{card.company_contact.phone && <a href={`tel:${card.company_contact.phone.replace(/\s+/g, '')}`}>{card.company_contact.phone}</a>}{card.company_contact.email && <a href={`mailto:${card.company_contact.email}`}>{card.company_contact.email}</a>}{card.company_contact.website && <a href={websiteUrl(card.company_contact.website)} target="_blank" rel="noreferrer">{card.company_contact.website}</a>}</div></div>}
        </div>
        <div className="card-actions">
          {active ? <><Button onClick={() => download.mutate({ cardNumber: card.card_number })} disabled={download.isPending}><Download />{download.isPending ? 'Preparing PDF…' : 'Download PDF'}</Button><Button variant="secondary" onClick={membershipApi.printPdf}><Printer />Print card</Button></> : <><label className="btn btn-secondary membership-upload-button"><Camera />{card.has_photo ? 'Replace photo' : 'Capture or upload photo'}<input type="file" accept="image/png,image/jpeg" capture="user" onChange={event => choosePhoto(event.target.files?.[0])} /></label><Button disabled><Download />Available after approval</Button></>}
          {upload.isPending && <span className="action-note">Uploading securely…</span>}
        </div>
        {(upload.isError || download.isError) && <div className="notice error-notice"><CircleHelp />{upload.error?.message || download.error?.message}</div>}
      </Card>
      <aside className="membership-side">
        <Card>
          <div className="profile-line"><div className="avatar large">{initials}</div><div><strong>{card.cardholder_name}</strong><span>Customer &amp; Supplier ID {card.customer_id}</span></div><StatusBadge status={card.profile_review_status} /></div>
          <dl className="profile-facts"><div><dt>Membership card number</dt><dd>{formattedNumber}</dd></div><div><dt>Customer ID</dt><dd>{card.customer_id}</dd></div><div><dt>Supplier ID</dt><dd>{card.supplier_id}</dd></div><div><dt>Issued on</dt><dd>{card.issued_on ? format(parseISO(card.issued_on), 'dd MMMM yyyy') : 'After approval'}</dd></div><div><dt>Valid until</dt><dd>{card.valid_until ? format(parseISO(card.valid_until), 'dd MMMM yyyy') : 'After approval'}</dd></div></dl>
        </Card>
        <Card>
          <div className="card-heading"><div><span className="eyebrow">Approval workflow</span><h2>{active ? 'Membership active' : 'Verification in progress'}</h2></div></div>
          <div className="membership-approval-steps"><div className={card.profile_review_status === 'Approved' ? 'complete' : ''}><span>{card.profile_review_status === 'Approved' ? <CheckCircle2 /> : <Clock3 />}</span><div><strong>Profile and KYC</strong><small>{card.profile_review_status}</small></div></div><div className={card.card_review_status === 'Approved' ? 'complete' : ''}><span>{card.card_review_status === 'Approved' ? <CheckCircle2 /> : <Clock3 />}</span><div><strong>Membership card</strong><small>{card.card_review_status}</small></div></div></div>
          {!card.has_photo && <p className="membership-guidance">Capture or upload a clear front-facing photograph. Then submit identity and address documents under Profile &amp; KYC.</p>}
          {card.status === 'Rejected' && card.operator_remarks && <div className="notice error-notice"><CircleHelp />{card.operator_remarks}</div>}
          <Link className="btn btn-secondary w-full" to="/profile/kyc"><FileCheck2 />Open Profile &amp; KYC</Link>
        </Card>
        <Card><div className="qr-safe"><QrCode /><div><strong>Scan-to-verify card</strong><span>The QR code checks the current card status directly against ERPNext without exposing private KYC documents.</span></div></div></Card>
      </aside>
    </div>
  </>
}
