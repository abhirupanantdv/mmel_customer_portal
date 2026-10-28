import type { Customer, LimitCategory, Transaction } from '../types'

export const mockCustomer: Customer = {
  id: '1258',
  name: 'Ahmed Rashid',
  membershipNumber: 'MH-00001258',
  defaultCurrency: 'FJD',
  kycStatus: 'Verified',
  accountStatus: 'Active',
  membershipValidUntil: '2028-12-31',
}

export const transactions: Transaction[] = [
  { id: '1', date: '2026-10-27', reference: 'FX-260194', type: 'Forex', description: 'USD currency purchase', currency: 'FJD', amount: '1135.00', direction: 'debit', status: 'Ready for Collection' },
  { id: '2', date: '2026-10-25', reference: 'WT-260178', type: 'Wallet', description: 'Wallet top-up', currency: 'FJD', amount: '750.00', direction: 'credit', status: 'Completed' },
  { id: '3', date: '2026-10-22', reference: 'MT-260144', type: 'Money Transfer', description: 'Transfer to India', currency: 'FJD', amount: '520.00', direction: 'debit', status: 'Completed' },
  { id: '4', date: '2026-10-18', reference: 'FX-260109', type: 'Forex', description: 'AUD currency purchase', currency: 'FJD', amount: '840.00', direction: 'debit', status: 'Completed' },
  { id: '5', date: '2026-10-14', reference: 'RF-260081', type: 'Refund', description: 'Booking cancellation refund', currency: 'FJD', amount: '120.00', direction: 'credit', status: 'Completed' },
  { id: '6', date: '2026-10-09', reference: 'FX-260052', type: 'Forex', description: 'NZD currency sale', currency: 'FJD', amount: '390.00', direction: 'credit', status: 'Completed' },
  { id: '7', date: '2026-10-04', reference: 'BK-260027', type: 'Booking', description: 'Pending forex booking', currency: 'FJD', amount: '625.00', direction: 'debit', status: 'Under Review' },
]

export const limitCategories: LimitCategory[] = [
  { id: 'travel', category: 'Travel Forex', period: 'Calendar year 2026', limit: '20000', used: '12500', pending: '1000', available: '6500', utilisation: 67.5, resetDate: '2027-01-01', ruleReference: 'DEMO-RBF-TRAVEL-01' },
  { id: 'remittance', category: 'Outward Remittances', period: 'Calendar year 2026', limit: '25000', used: '8750', pending: '500', available: '15750', utilisation: 37, resetDate: '2027-01-01', ruleReference: 'DEMO-RBF-REMIT-01' },
  { id: 'education', category: 'Education Payments', period: 'Rolling 12 months', limit: '30000', used: '6200', pending: '0', available: '23800', utilisation: 20.7, resetDate: 'Backend defined', ruleReference: 'DEMO-RBF-EDU-01' },
]

export const chartData = [
  { month: 'May', forex: 2450, transfers: 1200, inflow: 1800, outflow: 1450 },
  { month: 'Jun', forex: 3100, transfers: 1650, inflow: 2200, outflow: 1750 },
  { month: 'Jul', forex: 2800, transfers: 2100, inflow: 1650, outflow: 1900 },
  { month: 'Aug', forex: 3900, transfers: 1850, inflow: 2600, outflow: 2100 },
  { month: 'Sep', forex: 3400, transfers: 2400, inflow: 2000, outflow: 2250 },
  { month: 'Oct', forex: 4250, transfers: 2750, inflow: 3150, outflow: 2500 },
]

export const notifications = [
  { id: '1', title: 'Forex booking ready', body: 'Booking FX-260194 is ready for collection at Suva Central.', time: '12 min ago', unread: true },
  { id: '2', title: 'Wallet credited', body: 'A confirmed credit of FJD 750.00 was posted to your demo wallet.', time: '2 days ago', unread: true },
  { id: '3', title: 'KYC verified', body: 'Your customer verification is current.', time: '5 days ago', unread: false },
]
