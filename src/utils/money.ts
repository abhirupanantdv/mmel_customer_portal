import Decimal from 'decimal.js'

export const formatMoney = (amount: string, currency = 'FJD') =>
  new Intl.NumberFormat('en-FJ', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(new Decimal(amount).toNumber())

export const calculateQuote = (foreignAmount: string, rate: string, fee: string) => {
  const baseAmount = new Decimal(foreignAmount || 0).mul(rate)
  const total = baseAmount.plus(fee)
  return { baseAmount: baseAmount.toFixed(2), total: total.toFixed(2) }
}
