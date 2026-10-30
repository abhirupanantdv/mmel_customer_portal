import { formBody, frappeRequest } from './auth'

export interface SupportTicket {
  name: string
  subject: string
  status: string
  priority: string
  opening_date: string
  opening_time?: string
  modified: string
  resolution?: string
}

export interface SupportHome {
  company: { name: string; company_name: string; email: string; phone: string }
  priorities: string[]
  tickets: SupportTicket[]
}

export interface SupportTicketInput {
  subject: string
  description: string
  priority: string
  related_reference?: string
}

const method = '/api/method/moneygram.moneygram.api.customer_portal_support'

export const supportApi = {
  getSupportHome() {
    return frappeRequest<SupportHome>(`${method}.get_support_home`, { method: 'GET' })
  },

  createTicket(input: SupportTicketInput) {
    return frappeRequest<SupportTicket>(`${method}.create_ticket`, { method: 'POST', body: formBody(input) })
  },
}
