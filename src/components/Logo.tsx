export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-logo">
      <img src="/assets/mh-money-express-logo.svg" alt="MH Money Express" />
      {!compact && <span>Customer portal</span>}
    </div>
  )
}
