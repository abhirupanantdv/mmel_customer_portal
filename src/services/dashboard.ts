import { frappeRequest } from './auth'
import type { PortalTransaction } from './transactions'

export interface DashboardResponse {
  as_of: string
  customer: { id: string; name: string }
  wallet: {
    exists: boolean
    name?: string
    status: string
    currency: string
    available_balance: number
    held_balance: number
    last_transaction_on?: string
  }
  requests: { total: number; pending: number; completed: number; rejected_or_cancelled: number }
  membership: {
    exists: boolean
    card_number?: string
    status: string
    profile_review_status: string
    card_review_status: string
    valid_until?: string
  }
  limits: { rules: number; usage_entries: number }
  current_request: PortalTransaction | null
  recent_requests: PortalTransaction[]
  activity: Array<{ key: string; month: string; forex: number; transfers: number; wallet_in: number; wallet_out: number }>
}

const method = '/api/method/moneygram.moneygram.api.customer_portal_dashboard.get_dashboard'

export const dashboardApi = {
  getDashboard() {
    return frappeRequest<DashboardResponse>(method, { method: 'GET' })
  },
}
