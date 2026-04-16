import type { StateCreator } from 'zustand'
import type { AdDto, BrandDto } from '../../types/ad.types.ts'

export interface AdsSlice {
  currentBrand: BrandDto | null
  ads: AdDto[]
  adsLoading: boolean
  adsError: string | null
  adsEmpty: boolean
  fromCache: boolean

  setCurrentBrand: (brand: BrandDto | null) => void
  setAds: (ads: AdDto[]) => void
  setAdsLoading: (loading: boolean) => void
  setAdsError: (error: string | null) => void
  setAdsEmpty: (empty: boolean) => void
  setFromCache: (v: boolean) => void
}

export const createAdsSlice: StateCreator<AdsSlice> = (set) => ({
  currentBrand: null,
  ads: [],
  adsLoading: false,
  adsError: null,
  adsEmpty: false,
  fromCache: false,

  setCurrentBrand: (brand) => set({ currentBrand: brand }),
  setAds: (ads) => set({ ads }),
  setAdsLoading: (loading) => set({ adsLoading: loading }),
  setAdsError: (error) => set({ adsError: error }),
  setAdsEmpty: (empty) => set({ adsEmpty: empty }),
  setFromCache: (v) => set({ fromCache: v }),
})
