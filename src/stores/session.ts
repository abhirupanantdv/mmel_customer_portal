import { create } from 'zustand'

interface SessionState {
  isAuthenticated: boolean
  demoMode: boolean
  signInDemo: () => void
  signOut: () => void
}

export const useSession = create<SessionState>((set) => ({
  // Public demonstration build: sample-only data opens directly to the dashboard.
  // Replace this with backend session discovery before production integration.
  isAuthenticated: true,
  demoMode: true,
  signInDemo: () => set({ isAuthenticated: true, demoMode: true }),
  signOut: () => set({ isAuthenticated: false }),
}))
