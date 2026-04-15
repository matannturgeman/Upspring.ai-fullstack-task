import { create } from 'zustand'
import type { AdDto, BrandDto } from '../types/ad.types.ts'

interface AppState {
  currentBrand: BrandDto | null
  ads: AdDto[]
  adsLoading: boolean
  adsError: string | null
  adsEmpty: boolean
  fromCache: boolean
  competitors: { name: string; reason: string }[]
  selectedCompetitor: { name: string; reason: string } | null
  analysisMessages: AnalysisMessage[]
  selectedAdId: string | null
  analysisLoading: boolean
  analysisError: string | null

  setCurrentBrand: (brand: BrandDto | null) => void
  setAds: (ads: AdDto[]) => void
  setAdsLoading: (loading: boolean) => void
  setAdsError: (error: string | null) => void
  setAdsEmpty: (empty: boolean) => void
  setFromCache: (v: boolean) => void
  setCompetitors: (c: { name: string; reason: string }[]) => void
  setSelectedCompetitor: (c: { name: string; reason: string } | null) => void
  addMessage: (msg: AnalysisMessage) => void
  updateLastMessage: (id: number, text: string, streaming: boolean) => void
  clearMessages: () => void
  setSelectedAdId: (id: string | null) => void
  setAnalysisLoading: (v: boolean) => void
  setAnalysisError: (e: string | null) => void
  resetSearch: () => void
}

export interface AnalysisMessage {
  id: number
  role: 'user' | 'ai'
  text: string
  streaming?: boolean
  error?: boolean
}

export const useAppStore = create<AppState>((set) => ({
  currentBrand: null,
  ads: [],
  adsLoading: false,
  adsError: null,
  adsEmpty: false,
  fromCache: false,
  competitors: [],
  selectedCompetitor: null,
  analysisMessages: [],
  selectedAdId: null,
  analysisLoading: false,
  analysisError: null,

  setCurrentBrand: (brand) => set({ currentBrand: brand }),
  setAds: (ads) => set({ ads }),
  setAdsLoading: (loading) => set({ adsLoading: loading }),
  setAdsError: (error) => set({ adsError: error }),
  setAdsEmpty: (empty) => set({ adsEmpty: empty }),
  setFromCache: (v) => set({ fromCache: v }),
  setCompetitors: (c) => set({ competitors: c }),
  setSelectedCompetitor: (c) => set({ selectedCompetitor: c }),
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
  resetSearch: () => set({
    currentBrand: null,
    ads: [],
    adsError: null,
    adsEmpty: false,
    fromCache: false,
    competitors: [],
    selectedCompetitor: null,
    analysisMessages: [],
    selectedAdId: null,
    analysisLoading: false,
    analysisError: null,
  }),
}))
