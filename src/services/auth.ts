export interface CustomerSession {
  user: string
  customer_id: string
  full_name: string
  email: string
  mobile?: string
  date_of_birth?: string
  country?: string
}

export interface SignUpInput {
  full_name: string
  email: string
  password: string
  mobile: string
  date_of_birth?: string
  country: string
  consent: boolean
}

const configuredBaseUrl = import.meta.env.VITE_ERPNEXT_BASE_URL?.replace(/\/$/, '') ?? ''
let csrfToken = ''

export function apiUrl(path: string) {
  return `${configuredBaseUrl}${path}`
}

function serverError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const data = payload as Record<string, unknown>

  if (typeof data.message === 'string') return data.message
  if (typeof data._server_messages === 'string') {
    try {
      const messages = JSON.parse(data._server_messages) as string[]
      const first = JSON.parse(messages[0]) as { message?: string }
      if (first.message) return first.message
    } catch { /* use the generic fallback */ }
  }
  return fallback
}

export async function frappeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } : {}),
      ...(csrfToken ? { 'X-Frappe-CSRF-Token': csrfToken } : {}),
      ...init?.headers,
    },
  })
  if (response.status === 413) {
    throw new Error('The selected file is too large. Choose a smaller file or photo and try again.')
  }
  const payload = await response.json().catch(() => null) as { message?: T } | null
  if (!response.ok) throw new Error(serverError(payload, 'The ERPNext request failed. Please try again.'))
  return payload?.message as T
}

export async function frappeDownload(path: string): Promise<Blob> {
  const response = await fetch(apiUrl(path), { credentials: 'include' })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(serverError(payload, 'The ERPNext download failed. Please try again.'))
  }
  return response.blob()
}

export function formBody(values: object) {
  const body = new URLSearchParams()
  Object.entries(values as Record<string, string | boolean | undefined>).forEach(([key, value]) => {
    if (value !== undefined) body.set(key, String(value))
  })
  return body
}

async function refreshCsrfToken() {
  const result = await frappeRequest<{ csrf_token: string }>(
    '/api/method/moneygram.moneygram.api.allow_login.get_csrf_token',
    { method: 'GET' },
  )
  csrfToken = result.csrf_token
}

export const authApi = {
  async signIn(email: string, password: string) {
    await frappeRequest<string>('/api/method/login', {
      method: 'POST',
      body: formBody({ usr: email.trim().toLowerCase(), pwd: password }),
    })
    return this.me()
  },

  signUp(input: SignUpInput) {
    return frappeRequest<{ customer_id: string; supplier_id: string; membership_card: string; email: string; full_name: string; message: string }>(
      '/api/method/moneygram.moneygram.api.customer_portal_auth.sign_up',
      { method: 'POST', body: formBody(input) },
    )
  },

  me() {
    return frappeRequest<CustomerSession>(
      '/api/method/moneygram.moneygram.api.customer_portal_auth.me',
      { method: 'GET' },
    ).then(async (customer) => {
      await refreshCsrfToken()
      return customer
    })
  },

  async signOut() {
    await frappeRequest<string>('/api/method/logout', { method: 'POST', body: new URLSearchParams() })
    csrfToken = ''
  },
}
