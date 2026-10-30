import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { BadgeCheck, CircleAlert, Clock3 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { membershipApi } from '../services/membership'

function formatCardNumber(value?: string) {
  return value?.replace(/(\d{4})(?=\d)/g, '$1 ') || '—'
}

export function VerifyCardPage() {
  const { token = '' } = useParams()
  const card = useQuery({
    queryKey: ['verify-membership-card', token],
    queryFn: () => membershipApi.verifyCard(token),
    retry: false,
    enabled: Boolean(token),
  })

  const active = card.data?.valid === true
  return <main className="card-verification-page">
    <Logo />
    <section className={`card-verification-result ${active ? 'valid' : ''}`}>
      {card.isLoading && <><Clock3 /><h1>Checking membership card</h1><p>Please wait while the card is verified with ERPNext.</p></>}
      {card.isError && <><CircleAlert /><h1>Card not verified</h1><p>This QR code is invalid or the membership record is unavailable.</p></>}
      {card.data && <>
        {active ? <BadgeCheck /> : <CircleAlert />}
        <span className="eyebrow">Membership verification</span>
        <h1>{active ? 'Valid membership card' : 'Membership card inactive'}</h1>
        <div className="verification-card-number">{formatCardNumber(card.data.card_number)}</div>
        <dl>
          <div><dt>Cardholder</dt><dd>{card.data.cardholder_name}</dd></div>
          <div><dt>Status</dt><dd>{card.data.status}</dd></div>
          <div><dt>Valid until</dt><dd>{card.data.valid_until ? format(parseISO(card.data.valid_until), 'dd MMMM yyyy') : 'Not issued'}</dd></div>
        </dl>
      </>}
      <Link className="btn btn-primary" to="/">Visit MH Money Express</Link>
    </section>
  </main>
}
