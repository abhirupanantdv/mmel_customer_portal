import { frappeRequest } from './auth'

export type PortalTransactionType = 'Forex Exchange' | 'Money Transfer'
export type PortalTransactionStatus = 'Pending' | 'In Review' | 'Approved' | 'Completed' | 'Rejected' | 'Cancelled'

export interface PortalTransaction {
  id: string
  type: PortalTransactionType
  date: string
  completed_on?: string
  reference: string
  operational_reference?: string
  description: string
  amount: number
  currency: string
  direction: 'credit' | 'debit'
  status: PortalTransactionStatus
  branch: string
  receipt_type: 'forex' | 'money_transfer'
}

export interface PortalTransactionDetail extends PortalTransaction {
  request_type?: 'BUY' | 'SELL'
  foreign_currency?: string
  foreign_amount?: number
  exchange_rate?: number
  estimated_fjd_amount?: number
  service_fee?: number
  estimated_total?: number
  destination_country?: string
  receive_currency?: string
  send_amount?: number
  recipient_name?: string
  recipient_relationship?: string
  purpose?: string
  source_of_funds?: string
  provider_reference?: string
  money_transfer_reference?: string
  customer_notes?: string
}

export interface TransactionListResponse {
  data: PortalTransaction[]
  pagination: { page: number; page_length: number; total: number; total_pages: number }
  summary: { total: number; pending: number; completed: number; rejected_or_cancelled: number }
  filters: { types: PortalTransactionType[]; statuses: PortalTransactionStatus[] }
}

export interface TransactionFilters {
  page?: number
  pageLength?: number
  transactionType?: string
  status?: string
  search?: string
}

const method = '/api/method/moneygram.moneygram.api.customer_portal_transactions'

export const transactionsApi = {
  list(filters: TransactionFilters = {}) {
    const query = new URLSearchParams({
      page: String(filters.page ?? 1),
      page_length: String(filters.pageLength ?? 20),
    })
    if (filters.transactionType) query.set('transaction_type', filters.transactionType)
    if (filters.status) query.set('status', filters.status)
    if (filters.search) query.set('search', filters.search)
    return frappeRequest<TransactionListResponse>(`${method}.list_transactions?${query}`, { method: 'GET' })
  },

  get(transactionId: string) {
    return frappeRequest<PortalTransactionDetail>(
      `${method}.get_transaction?transaction_id=${encodeURIComponent(transactionId)}`,
      { method: 'GET' },
    )
  },
}
