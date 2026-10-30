import { Badge } from './ui'
import type { Status } from '../types'

export function StatusBadge({ status }: { status: Status | string }) {
  const tone = status === 'Completed' || status === 'Verified' || status === 'Active' || status === 'Approved' || status === 'Resolved' || status === 'Closed'
    ? 'success'
    : status === 'Pending' || status === 'Under Review' || status === 'In Review' || status === 'Ready for Collection' || status === 'Open' || status === 'Replied' || status === 'On Hold'
      ? 'warning'
      : status === 'Failed' || status === 'Restricted' || status === 'Rejected' || status === 'Cancelled'
        ? 'danger'
        : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}
