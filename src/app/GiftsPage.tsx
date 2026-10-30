import { useMemo, useRef, useState } from 'react'
import {
  Check, ChevronDown, ChevronRight, Download, Gift, Heart, MapPin, Minus, PackageCheck,
  Plus, Printer, Search, ShoppingBag, Sparkles, Store, Trash2, Truck, WalletCards,
} from 'lucide-react'
import { Badge, Button, Card, Field, Input } from '../components/ui'
import { useSession } from '../stores/session'
import { giftCategories, giftPaymentMethods, giftProducts, giftStores, type GiftProduct } from '../data/gifts'
import { assetUrl } from '../utils/assets'

type FulfilmentMode = 'delivery' | 'pickup'

interface CartLine {
  product: GiftProduct
  quantity: number
}

interface SampleOrder {
  id: string
  recipient: string
  sender: string
  message: string
  fulfilment: FulfilmentMode
  destination: string
  payment: string
  wrapped: boolean
  wrappingStyle: string
  lines: CartLine[]
  total: number
}

const money = (amount: number) => `F$${amount.toLocaleString('en-FJ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character] || character))

const textToBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

const splitMessage = (value: string) => {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const lines = ['', '']
  for (const word of words) {
    const index = lines[0].length < 44 ? 0 : 1
    if ((lines[index] + ' ' + word).trim().length <= 52) lines[index] = `${lines[index]} ${word}`.trim()
  }
  return lines.filter(Boolean)
}

async function giftCardSvg(order: SampleOrder) {
  const logoSource = await fetch(assetUrl('assets/mh-money-express-logo.svg')).then(response => response.text())
  const logo = `data:image/svg+xml;base64,${textToBase64(logoSource)}`
  const message = splitMessage(order.message || 'A special gift has been chosen just for you.')
  const itemCount = order.lines.reduce((total, line) => total + line.quantity, 0)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
    <defs>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".62" stop-color="#fff7f7"/><stop offset="1" stop-color="#ffd9dc"/></linearGradient>
      <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e31c2a"/><stop offset="1" stop-color="#980713"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="16" stdDeviation="20" flood-opacity=".18"/></filter>
    </defs>
    <rect width="1200" height="675" fill="#eef0f3"/>
    <g filter="url(#shadow)"><rect x="42" y="42" width="1116" height="591" rx="34" fill="url(#card)"/></g>
    <path d="M790 42h334c19 0 34 15 34 34v523c0 19-15 34-34 34H640z" fill="url(#ribbon)"/>
    <circle cx="1030" cy="160" r="185" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/><circle cx="1030" cy="160" r="125" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>
    <image href="${logo}" x="92" y="78" width="330" height="118" preserveAspectRatio="xMidYMid meet"/>
    <text x="92" y="245" font-family="Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="4" fill="#c90f1a">A GIFT FOR SOMEONE SPECIAL</text>
    <text x="92" y="315" font-family="Arial,sans-serif" font-size="48" font-weight="800" fill="#171a1f">For ${escapeXml(order.recipient)}</text>
    ${message.map((line, index) => `<text x="92" y="${380 + (index * 36)}" font-family="Georgia,serif" font-size="25" font-style="italic" fill="#5e6570">${escapeXml(line)}</text>`).join('')}
    <text x="92" y="493" font-family="Arial,sans-serif" font-size="16" fill="#777e87">WITH LOVE FROM</text>
    <text x="92" y="528" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#171a1f">${escapeXml(order.sender)}</text>
    <text x="92" y="587" font-family="Arial,sans-serif" font-size="15" fill="#7b828b">Gift reference ${escapeXml(order.id)} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'} · ${order.fulfilment === 'delivery' ? 'Home delivery' : 'Store pickup'}</text>
    <g transform="translate(858 215)"><path d="M76 34c-20-35-76-20-76 25 0 54 76 96 76 96s76-42 76-96c0-45-56-60-76-25z" fill="#fff" fill-opacity=".95"/><path d="M76 155s76-42 76-96c0-45-56-60-76-25" fill="none" stroke="#ffc8cd" stroke-width="4"/></g>
    <text x="934" y="420" text-anchor="middle" font-family="Arial,sans-serif" font-size="29" font-weight="800" fill="#fff">Your International Wallet</text>
    <text x="934" y="457" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#ffdfe2">A thoughtful surprise is on its way</text>
    <text x="934" y="562" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" fill="#fff" fill-opacity=".86">MH MONEY EXPRESS · FIJI</text>
  </svg>`
}

export function GiftsPage() {
  const customer = useSession(state => state.customer)
  const checkoutRef = useRef<HTMLDivElement>(null)
  const [category, setCategory] = useState('All')
  const [subcategory, setSubcategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [checkout, setCheckout] = useState(false)
  const [mode, setMode] = useState<FulfilmentMode>('delivery')
  const [storeId, setStoreId] = useState(giftStores[0].id)
  const [payment, setPayment] = useState(giftPaymentMethods[0].id)
  const [recipient, setRecipient] = useState('')
  const [sender, setSender] = useState(customer?.full_name || '')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [wrapped, setWrapped] = useState(true)
  const [wrappingStyle, setWrappingStyle] = useState('Ruby Red')
  const [message, setMessage] = useState('Thinking of you with love and warm wishes.')
  const [order, setOrder] = useState<SampleOrder | null>(null)
  const [cardError, setCardError] = useState('')

  const subcategories = useMemo(() => category === 'All'
    ? [...new Set(giftCategories.flatMap(item => item.subcategories))]
    : giftCategories.find(item => item.name === category)?.subcategories ?? [], [category])

  const products = useMemo(() => giftProducts.filter(product => {
    const query = search.trim().toLowerCase()
    return (category === 'All' || product.category === category)
      && (subcategory === 'All' || product.subcategory === subcategory)
      && (!query || `${product.name} ${product.description} ${product.category} ${product.subcategory}`.toLowerCase().includes(query))
  }), [category, subcategory, search])

  const cartLines = useMemo(() => giftProducts.flatMap(product => cart[product.id] ? [{ product, quantity: cart[product.id] }] : []), [cart])
  const itemCount = cartLines.reduce((total, line) => total + line.quantity, 0)
  const subtotal = cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0)
  const wrappingFee = wrapped && cartLines.length ? 7.5 : 0
  const deliveryFee = mode === 'delivery' && cartLines.length ? 12 : 0
  const total = subtotal + wrappingFee + deliveryFee
  const selectedStore = giftStores.find(store => store.id === storeId) || giftStores[0]

  const setQuantity = (productId: string, quantity: number) => setCart(current => {
    const next = { ...current }
    if (quantity <= 0) delete next[productId]
    else next[productId] = Math.min(quantity, 9)
    return next
  })

  const beginCheckout = () => {
    setCheckout(true)
    window.setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  const placeOrder = (event: React.FormEvent) => {
    event.preventDefault()
    const reference = `GFT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
    setOrder({
      id: reference,
      recipient: recipient.trim(),
      sender: sender.trim() || 'Someone who cares',
      message: message.trim(),
      fulfilment: mode,
      destination: mode === 'delivery' ? address.trim() : `${selectedStore.name}, ${selectedStore.address}`,
      payment: giftPaymentMethods.find(method => method.id === payment)?.label || payment,
      wrapped,
      wrappingStyle,
      lines: cartLines,
      total,
    })
    setCart({})
    setCheckout(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const downloadGiftCard = async () => {
    if (!order) return
    setCardError('')
    try {
      const svg = await giftCardSvg(order)
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${order.id}-gift-card.svg`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setCardError('The gift card could not be downloaded. Please try again.')
    }
  }

  const printGiftCard = async () => {
    if (!order) return
    const printWindow = window.open('', '_blank', 'width=1000,height=700')
    if (!printWindow) { setCardError('Allow pop-ups to print the gift card.'); return }
    printWindow.document.write('<p style="font-family:sans-serif;padding:24px">Preparing your gift card…</p>')
    try {
      const svg = await giftCardSvg(order)
      printWindow.document.open()
      printWindow.document.write(`<html><head><title>${order.id} Gift Card</title><style>@page{size:landscape;margin:0}body{margin:0;display:grid;place-items:center;background:#fff}svg{width:100%;height:auto;max-height:100vh}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${svg}<script>window.onload=()=>window.print()<\/script></body></html>`)
      printWindow.document.close()
    } catch {
      printWindow.close()
      setCardError('The gift card could not be printed. Please try again.')
    }
  }

  if (order) return <>
    <div className="page-header gift-success-header"><div><span className="eyebrow">Sample order placed</span><h1>Your gift is ready to share</h1><p>This prototype confirmation is stored only in this browser session. No payment was taken and no fulfilment request was sent.</p></div><Badge tone="success"><Check />Order prepared</Badge></div>
    <div className="gift-success-layout">
      <section className="shareable-gift-card" aria-label="Gift card preview">
        <div className="gift-card-copy"><img src={assetUrl('assets/mh-money-express-logo.svg')} alt="MH Money Express" /><span>A gift for someone special</span><h2>For {order.recipient}</h2><p>“{order.message || 'A special gift has been chosen just for you.'}”</p><small>With love from</small><strong>{order.sender}</strong><footer>{order.id} · {order.lines.reduce((sum, line) => sum + line.quantity, 0)} gift item(s)</footer></div>
        <div className="gift-card-ribbon"><Heart /><strong>Your International Wallet</strong><span>A thoughtful surprise is on its way</span></div>
      </section>
      <Card className="gift-order-confirmation"><div className="gift-confirm-icon"><PackageCheck /></div><span className="eyebrow">Order reference</span><h2>{order.id}</h2><dl><div><dt>For</dt><dd>{order.recipient}</dd></div><div><dt>Fulfilment</dt><dd>{order.fulfilment === 'delivery' ? 'Home delivery' : 'Store pickup'}</dd></div><div><dt>Destination</dt><dd>{order.destination}</dd></div><div><dt>Payment choice</dt><dd>{order.payment}</dd></div><div><dt>Gift wrapping</dt><dd>{order.wrapped ? order.wrappingStyle : 'Not selected'}</dd></div><div className="total"><dt>Sample total</dt><dd>{money(order.total)}</dd></div></dl><div className="gift-card-actions"><Button onClick={downloadGiftCard}><Download />Download gift card</Button><Button variant="secondary" onClick={printGiftCard}><Printer />Print gift card</Button></div>{cardError && <p className="error">{cardError}</p>}<Button variant="ghost" onClick={() => setOrder(null)}>Continue shopping</Button></Card>
    </div>
  </>

  return <>
    <section className="gift-shop-hero">
      <div><span className="eyebrow">Thoughtful gifts, near or far</span><h1>Gift Your Loved Ones</h1><p>Choose a meaningful gift, add a personal touch, and arrange pickup or delivery across Fiji.</p><div className="gift-hero-points"><span><Truck />Home delivery</span><span><Store />Store pickup</span><span><Gift />Gift wrapping</span></div></div>
      <div className="gift-hero-bag"><ShoppingBag /><strong>{itemCount}</strong><span>{itemCount === 1 ? 'item' : 'items'} in your gift bag</span>{itemCount > 0 && <Button onClick={beginCheckout}>Review bag <ChevronRight /></Button>}</div>
    </section>
    <div className="notice gift-prototype-notice"><Sparkles /><span><strong>Prototype catalogue:</strong> products, stock, stores, orders and payment choices are sample data. No charge, wallet debit or e-commerce order will be created.</span></div>

    <section className="gift-category-strip" aria-label="Gift categories">
      <button className={category === 'All' ? 'active' : ''} onClick={() => { setCategory('All'); setSubcategory('All') }}><Gift /><span>All gifts</span><small>{giftProducts.length} ideas</small></button>
      {giftCategories.map(item => <button key={item.id} className={category === item.name ? 'active' : ''} onClick={() => { setCategory(item.name); setSubcategory('All') }}><Heart /><span>{item.name}</span><small>{item.subcategories.length} collections</small></button>)}
    </section>

    <div className="gift-shop-layout">
      <main>
        <div className="gift-catalogue-toolbar"><label className="gift-search"><Search /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search gifts, categories or occasions" /></label><div className="gift-subcategories"><button className={subcategory === 'All' ? 'active' : ''} onClick={() => setSubcategory('All')}>All</button>{subcategories.map(item => <button key={item} className={subcategory === item ? 'active' : ''} onClick={() => setSubcategory(item)}>{item}</button>)}</div></div>
        <div className="gift-catalogue-heading"><div><span className="eyebrow">Curated for every occasion</span><h2>{category === 'All' ? 'All gift ideas' : category}</h2></div><span>{products.length} products</span></div>
        <div className="gift-product-grid">{products.map(product => {
          const quantity = cart[product.id] || 0
          return <article className="gift-product-card" key={product.id}>
            <div className="gift-product-image"><img src={product.image} alt={product.name} loading="lazy" />{product.badge && <Badge tone="warning">{product.badge}</Badge>}<button aria-label={`Save ${product.name} for later`}><Heart /></button></div>
            <div className="gift-product-copy"><small>{product.category} · {product.subcategory}</small><h3>{product.name}</h3><p>{product.description}</p><footer><strong>{money(product.price)}</strong>{quantity ? <div className="gift-quantity"><button onClick={() => setQuantity(product.id, quantity - 1)} aria-label={`Remove one ${product.name}`}><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity(product.id, quantity + 1)} aria-label={`Add one ${product.name}`}><Plus /></button></div> : <Button variant="secondary" onClick={() => setQuantity(product.id, 1)}><ShoppingBag />Add</Button>}</footer></div>
          </article>
        })}</div>
        {!products.length && <Card className="gift-empty"><Gift /><h3>No gifts match those filters</h3><p>Try another category, subcategory or search term.</p><Button variant="secondary" onClick={() => { setCategory('All'); setSubcategory('All'); setSearch('') }}>Show all gifts</Button></Card>}
      </main>

      <aside className="gift-bag-panel">
        <div className="card-heading"><div><span className="eyebrow">Your selection</span><h2>Gift bag</h2></div><Badge tone={itemCount ? 'danger' : 'neutral'}>{itemCount} items</Badge></div>
        {!cartLines.length ? <div className="gift-bag-empty"><ShoppingBag /><strong>Your bag is waiting</strong><p>Add a gift to see your order summary.</p></div> : <><div className="gift-bag-lines">{cartLines.map(line => <div key={line.product.id}><img src={line.product.image} alt="" /><div><strong>{line.product.name}</strong><small>{line.quantity} × {money(line.product.price)}</small></div><button onClick={() => setQuantity(line.product.id, 0)} aria-label={`Remove ${line.product.name}`}><Trash2 /></button></div>)}</div><dl className="gift-totals"><div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div><div><dt>Gift wrapping</dt><dd>{wrapped ? money(wrappingFee) : 'Not selected'}</dd></div><div><dt>{mode === 'delivery' ? 'Delivery' : 'Pickup'}</dt><dd>{deliveryFee ? money(deliveryFee) : 'Free'}</dd></div><div className="total"><dt>Sample total</dt><dd>{money(total)}</dd></div></dl><Button className="w-full" onClick={beginCheckout}>Continue to checkout <ChevronRight /></Button></>}
      </aside>
    </div>

    {checkout && cartLines.length > 0 && <div className="gift-checkout" ref={checkoutRef}>
      <div className="gift-checkout-head"><div><span className="eyebrow">Complete your sample order</span><h2>Delivery, wrapping and payment</h2><p>Enter sample details to preview the future e-commerce checkout experience.</p></div><button onClick={() => setCheckout(false)}><ChevronDown />Close</button></div>
      <form onSubmit={placeOrder}>
        <div className="gift-checkout-main">
          <Card><div className="card-heading"><div><span className="gift-step">1</span><h3>Who is this gift for?</h3></div></div><div className="form-row"><Field label="Loved one's name"><Input value={recipient} onChange={event => setRecipient(event.target.value)} required maxLength={80} placeholder="Recipient name" /></Field><Field label="Your name"><Input value={sender} onChange={event => setSender(event.target.value)} required maxLength={80} placeholder="Gift sender" /></Field></div><Field label="Recipient mobile number"><Input type="tel" value={phone} onChange={event => setPhone(event.target.value)} required placeholder="+679" /></Field></Card>

          <Card><div className="card-heading"><div><span className="gift-step">2</span><h3>Choose delivery or pickup</h3></div></div><div className="gift-mode-options"><label className={mode === 'delivery' ? 'selected' : ''}><input type="radio" name="mode" value="delivery" checked={mode === 'delivery'} onChange={() => setMode('delivery')} /><Truck /><span><strong>Home delivery</strong><small>Sample flat fee {money(12)}</small></span></label><label className={mode === 'pickup' ? 'selected' : ''}><input type="radio" name="mode" value="pickup" checked={mode === 'pickup'} onChange={() => setMode('pickup')} /><Store /><span><strong>Store pickup</strong><small>Free collection</small></span></label></div>{mode === 'delivery' ? <div className="gift-mode-fields"><Field label="Delivery address"><textarea className="input" rows={3} value={address} onChange={event => setAddress(event.target.value)} required placeholder="Street, area, town and delivery notes" /></Field><Field label="Preferred delivery date"><Input type="date" value={deliveryDate} min={new Date().toISOString().slice(0, 10)} onChange={event => setDeliveryDate(event.target.value)} required /></Field></div> : <div className="gift-store-grid">{giftStores.map(store => <label key={store.id} className={storeId === store.id ? 'selected' : ''}><input type="radio" name="store" value={store.id} checked={storeId === store.id} onChange={() => setStoreId(store.id)} /><MapPin /><span><strong>{store.name}</strong><small>{store.address}</small><small>{store.hours} · {store.phone}</small></span></label>)}</div>}</Card>

          <Card><div className="card-heading"><div><span className="gift-step">3</span><h3>Add a personal touch</h3></div></div><label className="gift-wrap-toggle"><input type="checkbox" checked={wrapped} onChange={event => setWrapped(event.target.checked)} /><span><Gift /><strong>Gift wrapping</strong><small>Premium wrapping and ribbon · {money(7.5)}</small></span></label>{wrapped && <><Field label="Wrapping style"><select className="input" value={wrappingStyle} onChange={event => setWrappingStyle(event.target.value)}>{['Ruby Red', 'Celebration Gold', 'Floral Bloom', 'Minimal White'].map(style => <option key={style}>{style}</option>)}</select></Field><Field label="Gift card message"><textarea className="input" rows={3} value={message} onChange={event => setMessage(event.target.value)} maxLength={104} placeholder="Write a short message for your loved one" /><small>{message.length}/104 characters</small></Field></>}</Card>

          <Card><div className="card-heading"><div><span className="gift-step">4</span><h3>Select a payment method</h3></div></div><div className="gift-payment-grid">{giftPaymentMethods.map(method => <label key={method.id} className={payment === method.id ? 'selected' : ''}><input type="radio" name="payment" value={method.id} checked={payment === method.id} onChange={() => setPayment(method.id)} /><WalletCards /><span><strong>{method.label}</strong><small>{method.detail}</small></span></label>)}</div><div className="notice"><WalletCards /><span>Payment integration is not active in this prototype. Selecting a method will not debit a wallet, card, bank account or transfer.</span></div></Card>
        </div>

        <Card className="gift-checkout-summary"><span className="eyebrow">Order review</span><h3>{itemCount} gift item(s)</h3><div className="gift-checkout-thumbs">{cartLines.slice(0, 4).map(line => <img key={line.product.id} src={line.product.image} alt={line.product.name} />)}</div><dl className="gift-totals"><div><dt>Products</dt><dd>{money(subtotal)}</dd></div><div><dt>Gift wrapping</dt><dd>{wrapped ? money(wrappingFee) : '—'}</dd></div><div><dt>{mode === 'delivery' ? 'Delivery' : 'Store pickup'}</dt><dd>{deliveryFee ? money(deliveryFee) : 'Free'}</dd></div><div className="total"><dt>Sample total</dt><dd>{money(total)}</dd></div></dl><Button type="submit" className="w-full"><PackageCheck />Place sample order</Button><small>No real order or payment will be created.</small></Card>
      </form>
    </div>}
  </>
}
