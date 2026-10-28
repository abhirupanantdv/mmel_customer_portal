import { addMinutes } from 'date-fns'
import { calculateQuote } from '../utils/money'
import { limitCategories, mockCustomer, transactions } from '../data/mock'
import type { ApiAdapter, QuoteRequest } from '../types'

const pause = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms))

export const mockApi: ApiAdapter = {
  async getCustomerProfile() { await pause(); return mockCustomer },
  async getTransactions() { await pause(); return transactions },
  async getApplicableLimits() { await pause(); return limitCategories },
  async getForexQuote(request: QuoteRequest) {
    await pause(550)
    const rate = request.destinationCurrency === 'USD' ? '2.2500' : request.destinationCurrency === 'AUD' ? '1.4800' : '1.3100'
    const serviceFee = '10.00'
    const { baseAmount, total } = calculateQuote(request.foreignAmount, rate, serviceFee)
    return {
      ...request,
      id: `DEMO-Q-${Date.now().toString().slice(-6)}`,
      rate,
      baseAmount,
      serviceFee,
      total,
      expiresAt: addMinutes(new Date(), 10).toISOString(),
      simulated: true as const,
    }
  },
}

// Integration seam: replace this export with an approved backend adapter.
// Never infer production routes from these frontend interface names.
export const api = mockApi
