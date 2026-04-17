import type { StateCreator } from 'zustand'
import type { AnalysisMessage } from './analysisSlice.ts'

export interface ChatSlice {
  chatOpen: boolean
  chatMessages: AnalysisMessage[]
  chatLoading: boolean
  chatError: string | null

  setChatOpen: (v: boolean) => void
  addChatMessage: (msg: AnalysisMessage) => void
  updateChatMessage: (id: string, text: string, streaming: boolean) => void
  clearChatMessages: () => void
  setChatLoading: (v: boolean) => void
  setChatError: (e: string | null) => void
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  chatOpen: false,
  chatMessages: [],
  chatLoading: false,
  chatError: null,

  setChatOpen: (v) => set({ chatOpen: v }),
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  updateChatMessage: (id, text, streaming) =>
    set((s) => ({
      chatMessages: s.chatMessages.map((m) => (m.id === id ? { ...m, text, streaming } : m)),
    })),
  clearChatMessages: () => set({ chatMessages: [] }),
  setChatLoading: (v) => set({ chatLoading: v }),
  setChatError: (e) => set({ chatError: e }),
})
