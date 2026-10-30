import { apiUrl, formBody, frappeDownload, frappeRequest } from './auth'

export type WalletRequestType = 'Funding' | 'Withdrawal'
export type WalletRequestStatus = 'Pending' | 'In Review' | 'Completed' | 'Rejected' | 'Cancelled'

export interface WalletLedgerEntry {
  name: string
  transaction_type: 'Funding' | 'Withdrawal' | 'Hold' | 'Release' | 'Capture' | 'Refund' | 'Reversal' | 'Adjustment'
  status: 'Posted' | 'Reversed'
  amount: number
  currency: string
  direction: 'credit' | 'debit' | 'neutral'
  description: string
  posting_datetime: string
  available_balance_after: number
  held_balance_after: number
  reference_doctype?: string
  reference_name?: string
}

export interface WalletRequest {
  name: string
  request_type: WalletRequestType
  status: WalletRequestStatus
  amount: number
  currency: string
  funding_method: string
  payment_reference?: string
  submitted_on: string
  completed_on?: string
  operator_remarks?: string
}

export interface LoyaltySummary {
  configured: boolean
  program?: string
  tier?: string
  points: number
  conversion_factor?: number
  value: number
  currency: string
  entries: Array<{ name: string; posting_date: string; loyalty_points: number; expiry_date?: string; invoice_type?: string; invoice?: string }>
}

export interface WalletSummary {
  wallet: {
    name: string
    status: 'Active' | 'Frozen' | 'Closed'
    currency: string
    available_balance: number
    held_balance: number
    total_balance: number
    last_transaction_on?: string
  }
  enabled: boolean
  allow_withdrawals: boolean
  request_limits: { minimum: number; maximum: number }
  pending_requests: number
  recent_transactions: WalletLedgerEntry[]
  loyalty: LoyaltySummary
}

export interface WalletTransactionList {
  data: WalletLedgerEntry[]
  pagination: { page: number; page_length: number; total: number; total_pages: number }
}

const method = '/api/method/moneygram.moneygram.api.customer_portal_wallet'

async function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const walletApi = {
  getWallet() {
    return frappeRequest<WalletSummary>(`${method}.get_wallet`, { method: 'GET' })
  },
  listTransactions(page = 1, transactionType = '') {
    const query = new URLSearchParams({ page: String(page), page_length: '20' })
    if (transactionType) query.set('transaction_type', transactionType)
    return frappeRequest<WalletTransactionList>(`${method}.list_transactions?${query}`, { method: 'GET' })
  },
  listRequests(limit = 20) {
    return frappeRequest<WalletRequest[]>(`${method}.list_requests?limit=${limit}`, { method: 'GET' })
  },
  createRequest(input: { request_type: WalletRequestType; amount: string; funding_method: string; payment_reference?: string; customer_notes?: string }) {
    return frappeRequest<Pick<WalletRequest, 'name' | 'request_type' | 'status' | 'amount' | 'currency' | 'submitted_on'>>(
      `${method}.create_request`, { method: 'POST', body: formBody(input) },
    )
  },
  cancelRequest(requestId: string) {
    return frappeRequest<{ name: string; status: 'Cancelled' }>(
      `${method}.cancel_request`, { method: 'POST', body: formBody({ request_id: requestId }) },
    )
  },
  async downloadStatement(startDate: string, endDate: string) {
    const query = new URLSearchParams({ start_date: startDate, end_date: endDate })
    const blob = await frappeDownload(`${method}.download_statement?${query}`)
    await saveBlob(blob, `wallet-statement-${startDate}-${endDate}.pdf`)
  },
  printStatement(startDate: string, endDate: string) {
    const query = new URLSearchParams({ start_date: startDate, end_date: endDate })
    window.open(apiUrl(`${method}.download_statement?${query}`), '_blank', 'noopener,noreferrer')
  },
  async downloadRequestReceipt(requestId: string) {
    const blob = await frappeDownload(`${method}.download_request_receipt?request_id=${encodeURIComponent(requestId)}`)
    await saveBlob(blob, `wallet-request-${requestId}.pdf`)
  },
  printRequestReceipt(requestId: string) {
    window.open(apiUrl(`${method}.download_request_receipt?request_id=${encodeURIComponent(requestId)}`), '_blank', 'noopener,noreferrer')
  },
}
