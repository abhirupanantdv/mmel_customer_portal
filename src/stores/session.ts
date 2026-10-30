import { create } from 'zustand'
import { authApi, type CustomerSession } from '../services/auth'

interface SessionState {
  isAuthenticated: boolean
  isReady: boolean
  demoMode: boolean
  customer: CustomerSession | null
  restoreSession: () => Promise<void>
  signIn: (email: string, password: string) => Promise<CustomerSession>
  signOut: () => Promise<void>
}

export const useSession = create<SessionState>((set) => ({
  isAuthenticated: false,
  isReady: false,
  demoMode: false,
  customer: null,
  restoreSession: async () => {
    try {
      const customer = await authApi.me()
      set({ customer, isAuthenticated: true, isReady: true })
    } catch {
      set({ customer: null, isAuthenticated: false, isReady: true })
    }
  },
  signIn: async (email, password) => {
    const customer = await authApi.signIn(email, password)
    set({ customer, isAuthenticated: true, isReady: true })
    return customer
  },
  signOut: async () => {
    try { await authApi.signOut() } finally {
      set({ customer: null, isAuthenticated: false, isReady: true })
    }
  },
}))
