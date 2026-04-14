import type { IAd } from '../models/Ad.ts'
import type mongoose from 'mongoose'

type RawSnapshot = {
  title?: string
  body?: { markup?: { text?: string }; text?: string }
  images?: { url?: string }[]
  videos?: { video_hd_url?: string; video_sd_url?: string; video_preview_image_url?: string }[]
  cards?: { title?: string }[]
}

type RawApifyAd = {
  id?: string
  ad_archive_id?: string
  publisher_platforms?: string[]
  is_active?: boolean
  start_date?: number
  snapshot?: RawSnapshot
}

export function parseApifyAd(raw: RawApifyAd): Omit<IAd, 'brandId'> & { brandId?: mongoose.Types.ObjectId } {
  const snap = raw.snapshot ?? {}
  const videos = snap.videos ?? []
  const images = snap.images ?? []
  const firstVideo = videos[0]
  const firstImage = images[0]

  const headline = snap.title ?? snap.cards?.[0]?.title
  const primaryText = snap.body?.markup?.text ?? snap.body?.text
  const imageUrl = firstImage?.url
  const videoUrl = firstVideo?.video_hd_url ?? firstVideo?.video_sd_url
  const thumbnailUrl = firstVideo?.video_preview_image_url ?? firstImage?.url

  const platforms = raw.publisher_platforms ?? []
  const platform = platforms.length > 0 ? platforms.join(', ') : 'Facebook/Instagram'

  const status: IAd['status'] =
    raw.is_active === true ? 'ACTIVE' :
    raw.is_active === false ? 'INACTIVE' :
    'UNKNOWN'

  return {
    adId: raw.id ?? raw.ad_archive_id,
    platform,
    ...(headline !== undefined && { headline }),
    ...(primaryText !== undefined && { primaryText }),
    ...(imageUrl !== undefined && { imageUrl }),
    ...(videoUrl !== undefined && { videoUrl }),
    ...(thumbnailUrl !== undefined && { thumbnailUrl }),
    startDate: raw.start_date ? new Date(raw.start_date * 1000) : undefined,
    status,
    performanceData: null,
    rawData: raw,
  }
}
