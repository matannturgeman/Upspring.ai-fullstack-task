import { z } from 'zod'

export const ExtractionSchema = z.object({
  adId: z.string().optional(),
  platform: z.string().default('Facebook/Instagram'),
  headline: z.string().optional(),
  primaryText: z.string().optional(),
  imageUrl: z.string().url().optional().catch(undefined),
  videoUrl: z.string().url().optional().catch(undefined),
  thumbnailUrl: z.string().url().optional().catch(undefined),
  startDate: z.date().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'UNKNOWN']).default('UNKNOWN'),
})

export type ExtractionResult = z.infer<typeof ExtractionSchema>

/** Count meaningfully populated display fields. Used to decide if AI fallback is needed. */
export function extractionScore(r: ExtractionResult): number {
  return [
    r.headline,
    r.primaryText,
    r.imageUrl ?? r.videoUrl ?? r.thumbnailUrl,
  ].filter(Boolean).length
}
