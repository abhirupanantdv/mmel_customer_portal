import { formBody, frappeRequest } from './auth'
import { downloadRequestReceipt, printRequestReceipt } from './receipt'

export type ForexRequestType = 'BUY' | 'SELL'

export interface ForexBranch {
  value: string
  label: string
  city?: string
  address?: string
  phone?: string
  currencies: string[]
}

export interface ForexOptions {
  request_type: ForexRequestType
  base_currency: 'FJD'
  currencies: string[]
  branches: ForexBranch[]
}

export interface ForexRequestInput {
  request_type: ForexRequestType
  currency: string
  foreign_amount: string
  warehouse: string
  customer_notes?: string
}

export interface LiveForexQuote {
  request_type: ForexRequestType
  foreign_currency: string
  foreign_amount: number
  warehouse: string
  exchange_rate: number
  estimated_fjd_amount: number
  service_fee: number
  estimated_total: number
  rate_item_price: string
  rate_item: string
  rate_price_list: string
  rate_valid_from?: string
  rate_valid_upto?: string
  quote_expires_on: string
}

export interface ForexRequestRecord extends LiveForexQuote {
  name: string
  status: string
  submitted_on: string
  currency_exchange?: string
}

export interface ForexRequestSummary {
  name: string
  request_type: ForexRequestType
  foreign_currency: string
  foreign_amount: number
  warehouse: string
  exchange_rate: number
  estimated_total: number
  status: string
  submitted_on: string
  currency_exchange?: string
}

const method = '/api/method/moneygram.moneygram.api.customer_portal_forex'

export const forexApi = {
  getOptions(requestType: ForexRequestType) {
    return frappeRequest<ForexOptions>(
      `${method}.get_options?request_type=${encodeURIComponent(requestType)}`,
      { method: 'GET' },
    )
  },

  getQuote(input: ForexRequestInput) {
    return frappeRequest<LiveForexQuote>(
      `${method}.get_quote`,
      { method: 'POST', body: formBody(input) },
    )
  },

  createRequest(input: ForexRequestInput) {
    return frappeRequest<ForexRequestRecord>(
      `${method}.create_request`,
      { method: 'POST', body: formBody(input) },
    )
  },

  listMyRequests(limit = 10) {
    return frappeRequest<ForexRequestSummary[]>(
      `${method}.list_my_requests?limit=${limit}`,
      { method: 'GET' },
    )
  },

  downloadReceipt(requestId: string) {
    const query = `request_id=${encodeURIComponent(requestId)}`
    return downloadRequestReceipt(`${method}.download_receipt?${query}`, `${requestId}-forex-request.pdf`)
  },

  printReceipt(requestId: string) {
    const query = `request_id=${encodeURIComponent(requestId)}&inline=1`
    printRequestReceipt(`${method}.download_receipt?${query}`)
  },
}
