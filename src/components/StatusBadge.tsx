import { Badge } from './ui'
import type { Status } from '../types'

export function StatusBadge({ status }: { status: Status | string }) {
  const tone = status === 'Completed' || status === 'Verified' || status === 'Active'
    ? 'success'
    : status === 'Pending' || status === 'Under Review' || status === 'Ready for Collection'
      ? 'warning'
      : status === 'Failed' || status === 'Restricted'
        ? 'danger'
        : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}
