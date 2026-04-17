import { create } from 'zustand'
import type { Session, Supermarket, Branch } from '@pos/shared-types'

interface AuthState {
  session:     Session | null
  supermarket: Supermarket | null
  branch:      Branch | null
  isLoading:   boolean

  setLoading:  (v: boolean) => void
  login:       (session: Session) => void
  logout:      () => void
  setContext:  (supermarket: Supermarket, branch: Branch) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session:     null,
  supermarket: null,
  branch:      null,
  isLoading:   true,

  setLoading:  (isLoading) => set({ isLoading }),
  login:       (session)   => set({ session }),
  logout:      ()          => set({ session: null }),
  setContext:  (supermarket, branch) => set({ supermarket, branch }),
}))
