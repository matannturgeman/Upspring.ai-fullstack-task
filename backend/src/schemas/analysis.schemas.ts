import { z } from 'zod'

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/

export const AnalysisBodySchema = z.object({
  adId: z
    .string()
    .min(1, 'adId is required')
    .regex(OBJECT_ID_REGEX, 'adId must be a valid ObjectId'),
})
