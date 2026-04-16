import type { StateCreator } from 'zustand'

export type Competitor = { name: string; reason: string }

export interface CompetitorSlice {
  competitors: Competitor[]
  selectedCompetitor: Competitor | null

  setCompetitors: (c: Competitor[]) => void
  setSelectedCompetitor: (c: Competitor | null) => void
}

export const createCompetitorSlice: StateCreator<CompetitorSlice> = (set) => ({
  competitors: [],
  selectedCompetitor: null,

  setCompetitors: (c) => set({ competitors: c }),
  setSelectedCompetitor: (c) => set({ selectedCompetitor: c }),
})
