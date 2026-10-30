import { formBody, frappeRequest } from './auth'
import { downloadRequestReceipt, printRequestReceipt } from './receipt'

export interface TransferDestination {
  country: string
  currency: string
  source_item: string
}

export interface TransferBranch {
  value: string
  label: string
  city?: string
  address?: string
  phone?: string
}

export interface TransferOptions {
  send_currency: 'FJD'
  destinations: TransferDestination[]
  branches: TransferBranch[]
}

export interface TransferRequestInput {
  destination_country: string
  receive_currency: string
  send_amount: string
  warehouse: string
  recipient_name: string
  recipient_relationship: string
  purpose: string
  source_of_funds: string
  customer_notes?: string
}

export interface TransferRequestRecord {
  name: string
  status: string
  submitted_on: string
  destination_country: string
  receive_currency: string
  send_currency: 'FJD'
  send_amount: number
  warehouse: string
  recipient_name: string
  provider_reference?: string
  money_transfer_reference?: string
}

const method = '/api/method/moneygram.moneygram.api.customer_portal_money_transfer'

export const moneyTransferApi = {
  getOptions() {
    return frappeRequest<TransferOptions>(`${method}.get_options`, { method: 'GET' })
  },

  createRequest(input: TransferRequestInput) {
    return frappeRequest<TransferRequestRecord>(
      `${method}.create_request`,
      { method: 'POST', body: formBody(input) },
    )
  },

  listMyRequests(limit = 6) {
    return frappeRequest<TransferRequestRecord[]>(
      `${method}.list_my_requests?limit=${limit}`,
      { method: 'GET' },
    )
  },

  downloadReceipt(requestId: string) {
    const query = `request_id=${encodeURIComponent(requestId)}`
    return downloadRequestReceipt(`${method}.download_receipt?${query}`, `${requestId}-money-transfer-request.pdf`)
  },

  printReceipt(requestId: string) {
    const query = `request_id=${encodeURIComponent(requestId)}&inline=1`
    printRequestReceipt(`${method}.download_receipt?${query}`)
  },
}
