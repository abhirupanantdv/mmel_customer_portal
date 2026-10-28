export type Money = { amount: string; currency: string }
export type Status = 'Completed' | 'Pending' | 'Approved' | 'Ready for Collection' | 'Under Review' | 'Failed'

export interface Customer {
  id: string
  name: string
  membershipNumber: string
  defaultCurrency: string
  kycStatus: 'Verified' | 'Pending' | 'Update Required'
  accountStatus: 'Active' | 'Restricted' | 'Suspended'
  membershipValidUntil: string
}

export interface Transaction {
  id: string
  date: string
  reference: string
  type: 'Forex' | 'Money Transfer' | 'Wallet' | 'Refund' | 'Booking'
  description: string
  currency: string
  amount: string
  direction: 'credit' | 'debit'
  status: Status
}

export interface LimitCategory {
  id: string
  category: string
  period: string
  limit: string
  used: string
  pending: string
  available: string
  utilisation: number
  resetDate: string
  ruleReference: string
}

export interface QuoteRequest {
  transactionType: 'buy' | 'sell'
  sourceCurrency: string
  destinationCurrency: string
  foreignAmount: string
}

export interface ForexQuote extends QuoteRequest {
  id: string
  rate: string
  baseAmount: string
  serviceFee: string
  total: string
  expiresAt: string
  simulated: true
}

export interface ApiAdapter {
  getCustomerProfile(): Promise<Customer>
  getTransactions(): Promise<Transaction[]>
  getApplicableLimits(): Promise<LimitCategory[]>
  getForexQuote(request: QuoteRequest): Promise<ForexQuote>
}
