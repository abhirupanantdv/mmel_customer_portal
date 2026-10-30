import { Link } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, Banknote, Building2, CheckCircle2, ChevronRight,
  CircleDollarSign, CreditCard, FileCheck2, Globe2, Headphones, LockKeyhole,
  MapPin, Repeat2, Send, ShieldCheck, Sparkles, UserRound,
} from 'lucide-react'
import { assetUrl } from '../utils/assets'

const services = [
  {
    icon: Repeat2,
    eyebrow: 'Foreign exchange',
    title: 'Buy or sell foreign currency',
    copy: 'Choose a currency, view the branch-configured estimate and select the outlet where you want to complete your exchange.',
    action: 'Explore forex',
    to: '/register',
    tone: 'red',
  },
  {
    icon: Send,
    eyebrow: 'International transfers',
    title: 'Prepare a money transfer request',
    copy: 'Select a destination, add recipient and purpose information, then send the request to your preferred branch for review.',
    action: 'Start a transfer',
    to: '/register',
    tone: 'blue',
  },
  {
    icon: CreditCard,
    eyebrow: 'Customer membership',
    title: 'Keep your profile ready',
    copy: 'Manage your personal profile, KYC documents and MH MoneyGram membership card from one secure customer account.',
    action: 'Create your account',
    to: '/register',
    tone: 'gold',
  },
]

const steps = [
  { number: '01', icon: UserRound, title: 'Create your account', copy: 'Register with your contact details and keep your customer profile up to date.' },
  { number: '02', icon: CircleDollarSign, title: 'Build your request', copy: 'Choose the service, amount, currency or destination, and the branch that suits you.' },
  { number: '03', icon: Building2, title: 'Complete it at the branch', copy: 'An authorised operator confirms the final rate, eligibility and transaction details.' },
]

export function LandingPage() {
  return <div className="landing-page">
    <header className="landing-nav">
      <Link to="/" className="landing-brand" aria-label="MH Money Express home"><img src={assetUrl('assets/mh-money-express-logo.svg')} alt="MH Money Express" /></Link>
      <nav aria-label="Landing page navigation"><a href="#services">Services</a><a href="#how-it-works">How it works</a><a href="#membership">Membership</a><a href="#support">Support</a></nav>
      <div className="landing-nav-actions"><Link to="/login" className="landing-signin">Sign in</Link><Link to="/register" className="btn btn-primary">Create account<ArrowRight /></Link></div>
    </header>

    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker"><Sparkles />Your International Wallet</span>
          <h1>Exchange currency and prepare international transfers with confidence.</h1>
          <p>One customer portal for foreign exchange requests, international money transfer requests, your membership card and KYC profile.</p>
          <div className="landing-hero-actions"><Link to="/register" className="btn btn-primary">Get started<ArrowRight /></Link><Link to="/login" className="btn landing-ghost">I already have an account</Link></div>
          <div className="landing-assurance"><span><ShieldCheck />Secure customer access</span><span><MapPin />Choose your service branch</span><span><BadgeCheck />Operator-reviewed completion</span></div>
        </div>
        <div className="landing-service-panel" aria-label="Available portal services">
          <div className="landing-panel-head"><div><span>What would you like to do?</span><strong>Start with the right service</strong></div><Globe2 /></div>
          <Link to="/register" className="landing-service-option"><span className="service-option-icon red"><Banknote /></span><div><strong>Buy foreign currency</strong><small>View an estimate and select a branch</small></div><ChevronRight /></Link>
          <Link to="/register" className="landing-service-option"><span className="service-option-icon dark"><Repeat2 /></span><div><strong>Sell foreign currency</strong><small>Prepare a branch exchange request</small></div><ChevronRight /></Link>
          <Link to="/register" className="landing-service-option"><span className="service-option-icon blue"><Send /></span><div><strong>Send money internationally</strong><small>Submit recipient details for review</small></div><ChevronRight /></Link>
          <div className="landing-panel-note"><LockKeyhole /><span>Sign in or create an account to continue securely.</span></div>
        </div>
      </section>

      <section className="landing-trust-row" aria-label="Portal benefits"><div><ShieldCheck /><span>Customer-controlled profile</span></div><div><FileCheck2 /><span>KYC documents in one place</span></div><div><MapPin /><span>Branch selection before submission</span></div><div><Headphones /><span>Outlet support when you need it</span></div></section>

      <section className="landing-section" id="services">
        <div className="landing-section-head"><div><span className="eyebrow">Services in one account</span><h2>Start online. Complete with the right team.</h2></div><p>The portal helps you prepare the request and carry the correct information forward. Final financial transactions remain controlled by authorised operators.</p></div>
        <div className="landing-services-grid">{services.map(({ icon: Icon, ...service }) => <article className={`landing-service-card ${service.tone}`} key={service.title}><span className="landing-card-icon"><Icon /></span><span className="eyebrow">{service.eyebrow}</span><h3>{service.title}</h3><p>{service.copy}</p><Link to={service.to}>{service.action}<ArrowRight /></Link></article>)}</div>
      </section>

      <section className="landing-steps-wrap" id="how-it-works">
        <div className="landing-section landing-steps-section"><div className="landing-section-head light"><div><span className="eyebrow">A clear path</span><h2>From customer account to branch-ready request.</h2></div><p>Each request keeps the customer, branch and service details together so the outlet team can review the next step.</p></div><div className="landing-steps">{steps.map(({ icon: Icon, ...step }) => <article key={step.number}><span className="step-number">{step.number}</span><span className="step-icon"><Icon /></span><h3>{step.title}</h3><p>{step.copy}</p></article>)}</div></div>
      </section>

      <section className="landing-section landing-membership" id="membership">
        <div className="landing-membership-copy"><span className="eyebrow">MH MoneyGram membership</span><h2>Your customer details, ready when you need them.</h2><p>Keep your identity profile and supporting documents together, then access your digital membership card from your customer account.</p><ul><li><CheckCircle2 />Review and update your customer profile</li><li><CheckCircle2 />Upload supported KYC documents securely</li><li><CheckCircle2 />Access your membership card in the portal</li><li><CheckCircle2 />Track requests using internal references</li></ul><Link to="/register" className="btn btn-primary">Create your customer account<ArrowRight /></Link></div>
        <div className="landing-card-visual"><div className="landing-card-glow" /><img src={assetUrl('assets/membership-card-exact-logo.png')} alt="MH Money Express customer membership card" /><div className="landing-card-caption"><CreditCard /><div><strong>One customer identity</strong><span>For profile, KYC and service requests</span></div></div></div>
      </section>

      <section className="landing-section landing-safety">
        <div><span className="landing-safety-icon"><ShieldCheck /></span><span className="eyebrow">Designed around controlled transactions</span><h2>Estimates and requests stay separate from completed transactions.</h2></div><div className="landing-safety-grid"><article><strong>Branch-configured information</strong><p>Foreign exchange estimates use the currency and branch configuration available in the operating system.</p></article><article><strong>Compliance before completion</strong><p>KYC, limits, cash availability and transaction details are reviewed before an operator completes a service.</p></article><article><strong>Provider references only when issued</strong><p>International transfer provider references appear only after confirmation through the authorised workflow.</p></article></div>
      </section>

      <section className="landing-cta" id="support"><div><span className="eyebrow">Ready to begin?</span><h2>Bring your international money needs into one secure account.</h2><p>Create your MH MoneyGram customer account, complete your profile and prepare your next service request.</p></div><div><Link to="/register" className="btn btn-primary">Create account<ArrowRight /></Link><Link to="/login" className="btn landing-light-button">Sign in</Link></div></section>
    </main>

    <footer className="landing-footer"><div><img src={assetUrl('assets/mh-money-express-logo.svg')} alt="MH Money Express" /><p>Your International Wallet</p></div><div><strong>Customer services</strong><Link to="/register">Foreign exchange</Link><Link to="/register">Money transfer requests</Link><Link to="/register">Membership and KYC</Link></div><div><strong>Account</strong><Link to="/login">Sign in</Link><Link to="/register">Create account</Link><Link to="/forgot-password">Forgot password</Link></div><div><strong>Important information</strong><p>Final rates, fees, eligibility and completion are confirmed through the authorised branch and provider workflow.</p></div></footer>
  </div>
}
