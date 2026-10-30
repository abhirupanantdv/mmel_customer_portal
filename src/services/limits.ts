import { frappeRequest } from './auth'

export interface ExchangeControlRule {
  code: string
  category: string
  label: string
  limit: number
  currency: 'FJD'
  period: 'month' | 'year' | 'trip' | 'invoice' | 'application'
  basis: string
  page: number
  requirements: string[]
  notes: string[]
  period_key: string | null
  completed: number
  pending: number
  available: number | null
  cumulative: boolean
  record_count: number
}

export interface LimitsResponse {
  policy: {
    title: string
    effective_from: string
    source: string
  }
  customer: string
  as_of: string
  ledger_entries: number
  rules: ExchangeControlRule[]
  recent_usage: Array<{
    name: string
    rule_code: string
    period_key: string
    usage_state: 'Pending' | 'Completed' | 'Released'
    amount_fjd: number
    transaction_date: string
    source_doctype?: string
    source_name?: string
  }>
  disclaimer: string
}

const method = '/api/method/moneygram.moneygram.api.customer_portal_limits'

export const limitsApi = {
  getMyLimits() {
    return frappeRequest<LimitsResponse>(`${method}.get_my_limits`, { method: 'GET' })
  },
}
