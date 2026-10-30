import { apiUrl, frappeDownload, frappeRequest } from './auth'

export type StatementType = 'consolidated' | 'forex' | 'money_transfer' | 'wallet'
export type StatementFormat = 'pdf' | 'csv'

export interface StatementPreview {
  statement_type: StatementType
  statement_label: string
  start_date: string
  end_date: string
  summary: {
    records: number
    by_type: Record<'Forex Exchange' | 'Money Transfer' | 'Wallet', number>
    totals: Record<string, { credit: number; debit: number; neutral: number }>
  }
  recent: Array<{
    id: string
    type: 'Forex Exchange' | 'Money Transfer' | 'Wallet'
    date: string
    reference: string
    description: string
    amount: number
    currency: string
    direction: 'credit' | 'debit' | 'neutral'
    status: string
  }>
}

const method = '/api/method/moneygram.moneygram.api.customer_portal_statements'

function query(type: StatementType, startDate: string, endDate: string, format?: StatementFormat) {
  const params = new URLSearchParams({ statement_type: type, start_date: startDate, end_date: endDate })
  if (format) params.set('file_format', format)
  return params
}

export const statementsApi = {
  preview(type: StatementType, startDate: string, endDate: string) {
    return frappeRequest<StatementPreview>(`${method}.get_preview?${query(type, startDate, endDate)}`, { method: 'GET' })
  },

  async download(type: StatementType, startDate: string, endDate: string, format: StatementFormat) {
    const blob = await frappeDownload(`${method}.download_statement?${query(type, startDate, endDate, format)}`)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${type.replace('_', '-')}-statement-${startDate}-${endDate}.${format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },

  print(type: StatementType, startDate: string, endDate: string) {
    window.open(apiUrl(`${method}.download_statement?${query(type, startDate, endDate, 'pdf')}`), '_blank', 'noopener,noreferrer')
  },
}
