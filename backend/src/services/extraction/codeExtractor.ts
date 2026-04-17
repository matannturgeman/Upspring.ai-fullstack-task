import { z } from 'zod'
import { ExtractionSchema, type ExtractionResult } from '../../schemas/extraction.schemas.ts'

// Zod shape for the normalized raw ad format (Apify + all scrapers normalize to this)
const RawShape = z
  .object({
    id: z.string().optional(),
    ad_archive_id: z.string().optional(),
    publisher_platforms: z.array(z.string()).optional(),
    is_active: z.boolean().optional(),
    start_date: z.number().optional(),
    ad_delivery_start_time: z.string().optional(),
    status: z.string().optional(),
    ad_creative_bodies: z.array(z.string()).optional(),
    ad_creative_link_titles: z.array(z.string()).optional(),
    snapshot: z
      .object({
        title: z.string().optional(),
        body: z
          .object({
            markup: z.object({ text: z.string().optional() }).optional(),
            text: z.string().optional(),
          })
          .optional(),
        images: z.array(z.object({ url: z.string().optional() })).optional(),
        videos: z
          .array(
            z.object({
              video_hd_url: z.string().optional(),
              video_sd_url: z.string().optional(),
              video_preview_image_url: z.string().optional(),
            }),
          )
          .optional(),
        cards: z.array(z.object({ title: z.string().optional() })).optional(),
      })
      .optional(),
  })
  .passthrough()

export function codeExtract(rawData: unknown): ExtractionResult | null {
  const parsed = RawShape.safeParse(rawData)
  if (!parsed.success) return null

  const raw = parsed.data
  const snap = raw.snapshot ?? {}
  const firstVideo = (snap.videos ?? [])[0]
  const firstImage = (snap.images ?? [])[0]

  const headline = snap.title ?? snap.cards?.[0]?.title ?? raw.ad_creative_link_titles?.[0]
  const primaryText = snap.body?.markup?.text ?? snap.body?.text ?? raw.ad_creative_bodies?.[0]
  const imageUrl = firstImage?.url
  const videoUrl = firstVideo?.video_hd_url ?? firstVideo?.video_sd_url
  const thumbnailUrl = firstVideo?.video_preview_image_url ?? firstImage?.url

  const platforms = raw.publisher_platforms ?? []
  const platform = platforms.length > 0 ? platforms.join(', ') : 'Facebook/Instagram'

  let status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN' = 'UNKNOWN'
  if (raw.is_active === true || raw.status === 'ACTIVE') status = 'ACTIVE'
  else if (raw.is_active === false || raw.status === 'INACTIVE') status = 'INACTIVE'

  let startDate: Date | undefined
  if (raw.start_date) startDate = new Date(raw.start_date * 1000)
  else if (raw.ad_delivery_start_time) startDate = new Date(raw.ad_delivery_start_time)

  return ExtractionSchema.parse({
    adId: raw.id ?? raw.ad_archive_id,
    platform,
    ...(headline !== undefined && { headline }),
    ...(primaryText !== undefined && { primaryText }),
    ...(imageUrl !== undefined && { imageUrl }),
    ...(videoUrl !== undefined && { videoUrl }),
    ...(thumbnailUrl !== undefined && { thumbnailUrl }),
    ...(startDate !== undefined && { startDate }),
    status,
  })
}
