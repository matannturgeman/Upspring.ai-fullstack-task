import type { StateCreator } from 'zustand'

export interface AnalysisMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  streaming?: boolean
  error?: boolean
}

export interface AnalysisSlice {
  analysisMessages: AnalysisMessage[]
  selectedAdId: string | null
  analysisLoading: boolean
  analysisError: string | null

  addMessage: (msg: AnalysisMessage) => void
  updateLastMessage: (id: string, text: string, streaming: boolean) => void
  clearMessages: () => void
  setSelectedAdId: (id: string | null) => void
  setAnalysisLoading: (v: boolean) => void
  setAnalysisError: (e: string | null) => void
}

export const createAnalysisSlice: StateCreator<AnalysisSlice> = (set) => ({
  analysisMessages: [],
  selectedAdId: null,
  analysisLoading: false,
  analysisError: null,

  addMessage: (msg) => set(s => ({ analysisMessages: [...s.analysisMessages, msg] })),
  updateLastMessage: (id, text, streaming) =>
    set(s => ({
      analysisMessages: s.analysisMessages.map(m =>
        m.id === id ? { ...m, text, streaming } : m
      ),
    })),
  clearMessages: () => set({ analysisMessages: [] }),
  setSelectedAdId: (id) => set({ selectedAdId: id }),
  setAnalysisLoading: (v) => set({ analysisLoading: v }),
  setAnalysisError: (e) => set({ analysisError: e }),
})
