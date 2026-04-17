import { z } from 'zod'

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/

export const AnalysisBodySchema = z.object({
  adId: z
    .string()
    .min(1, 'adId is required')
    .regex(OBJECT_ID_REGEX, 'adId must be a valid ObjectId'),
})

export const CompetitorBodySchema = z.object({
  brandName: z.string().min(1).max(200),
  brandId: z
    .string()
    .min(1, 'brandId is required')
    .regex(OBJECT_ID_REGEX, 'brandId must be a valid ObjectId'),
})

export const ChatBodySchema = z.object({
  brandId: z
    .string()
    .min(1, 'brandId is required')
    .regex(OBJECT_ID_REGEX, 'brandId must be a valid ObjectId'),
  messages: z
    .array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
    }))
    .min(1)
    .max(40),
})
