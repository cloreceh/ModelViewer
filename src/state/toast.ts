import { create } from 'zustand'

// One short message at a time (Week 3 "Toast" pattern), with an optional
// action such as Undo. A new message replaces the one showing.
export interface ToastMessage {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

interface ToastState {
  toast?: ToastMessage
  show: (message: string, action?: ToastMessage['action']) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToast = create<ToastState>()((set) => ({
  show: (message, action) => set({ toast: { id: nextId++, message, action } }),
  dismiss: (id) => set((s) => (s.toast?.id === id ? { toast: undefined } : s)),
}))
