import { create } from 'zustand'

interface SessionState {
  isAuthenticated: boolean
  demoMode: boolean
  signInDemo: () => void
  signOut: () => void
}

export const useSession = create<SessionState>((set) => ({
  isAuthenticated: false,
  demoMode: true,
  signInDemo: () => set({ isAuthenticated: true, demoMode: true }),
  signOut: () => set({ isAuthenticated: false }),
}))
