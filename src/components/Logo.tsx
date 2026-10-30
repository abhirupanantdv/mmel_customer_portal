import { assetUrl } from '../utils/assets'

export function Logo({ compact = false, hideLabel = false }: { compact?: boolean; hideLabel?: boolean }) {
  return (
    <div className="brand-logo">
      <img src={assetUrl('assets/mh-money-express-logo.svg')} alt="MH Money Express" />
      {!compact && !hideLabel && <span>Customer portal</span>}
    </div>
  )
}
