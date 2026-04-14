export interface AdDto {
  _id: string
  brandId: string
  adId?: string
  platform: string
  headline?: string
  primaryText?: string
  imageUrl?: string
  videoUrl?: string
  thumbnailUrl?: string
  startDate?: string
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'
  performanceData: null
}

export interface BrandDto {
  _id: string
  name: string
  normalizedName: string
  lastFetched: string
  adCount: number
}

export interface AdsResponse {
  brand: BrandDto | null
  ads: AdDto[]
  fromCache: boolean
  empty?: boolean
  partial?: boolean
  message?: string
}
