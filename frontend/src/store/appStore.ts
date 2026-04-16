import { create } from 'zustand'
import { createAdsSlice, type AdsSlice } from './slices/adsSlice.ts'
import { createCompetitorSlice, type CompetitorSlice } from './slices/competitorSlice.ts'
import { createAnalysisSlice, type AnalysisSlice } from './slices/analysisSlice.ts'
import { createChatSlice, type ChatSlice } from './slices/chatSlice.ts'

export type { AnalysisMessage } from './slices/analysisSlice.ts'
export type { Competitor } from './slices/competitorSlice.ts'

type AppState = AdsSlice & CompetitorSlice & AnalysisSlice & ChatSlice & {
  resetSearch: () => void
}

export const useAppStore = create<AppState>((...a) => ({
  ...createAdsSlice(...a),
  ...createCompetitorSlice(...a),
  ...createAnalysisSlice(...a),
  ...createChatSlice(...a),

  resetSearch: () => a[0]({
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
    chatOpen: false,
    chatMessages: [],
    chatLoading: false,
    chatError: null,
  }),
}))
