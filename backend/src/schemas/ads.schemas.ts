import { z } from 'zod'

// Request schemas
export const AdsQuerySchema = z.object({
  brand: z.string().min(1).max(100).transform(v => v.replace(/[<>"']/g, '').trim()),
  limit: z.string().optional().transform(v => Math.min(parseInt(v ?? '20') || 20, 50)),
  forceRefresh: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
})

// Response schemas
export const AdSchema = z.object({
  _id: z.string(),
  brandId: z.string(),
  adId: z.string().optional(),
  platform: z.string(),
  headline: z.string().optional(),
  primaryText: z.string().optional(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  startDate: z.union([z.date(), z.string()]).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'UNKNOWN']),
  performanceData: z.null(),
})

export const BrandSchema = z.object({
  _id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  lastFetched: z.union([z.date(), z.string()]),
  adCount: z.number(),
})

export const AdsResponseSchema = z.discriminatedUnion('empty', [
  z.object({
    empty: z.literal(true),
    ads: z.array(z.unknown()),
    brand: z.null(),
    message: z.string(),
  }),
  z.object({
    empty: z.literal(false).optional(),
    brand: BrandSchema,
    ads: z.array(AdSchema.passthrough()),
    fromCache: z.boolean(),
    partial: z.boolean().optional(),
  }),
])

export type AdsQuery = z.infer<typeof AdsQuerySchema>
export type AdDto = z.infer<typeof AdSchema>
export type AdsResponse = z.infer<typeof AdsResponseSchema>
