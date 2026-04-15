import { z } from 'zod'

export const AnalysisBodySchema = z.object({
  adId: z.string().min(1, 'adId is required'),
})
