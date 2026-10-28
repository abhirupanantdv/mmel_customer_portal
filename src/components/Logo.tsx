export function Logo({ compact = false, hideLabel = false }: { compact?: boolean; hideLabel?: boolean }) {
  return (
    <div className="brand-logo">
      <img src="/assets/mh-money-express-logo.svg" alt="MH Money Express" />
      {!compact && !hideLabel && <span>Customer portal</span>}
    </div>
  )
}
