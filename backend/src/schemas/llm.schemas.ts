import { z } from 'zod'

// SSE chunk sent from server to client
export const AnalysisSseChunkSchema = z.union([
  z.object({ text: z.string() }),
  z.object({ error: z.string() }),
])
export type AnalysisSseChunk = z.infer<typeof AnalysisSseChunkSchema>

// Anthropic streaming event — the fields we care about
export const AnthropicStreamEventSchema = z.object({
  type: z.string(),
  delta: z
    .object({
      type: z.string(),
      text: z.string().optional(),
    })
    .optional(),
})

// Perplexity API response shape
export const PerplexityResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    })
  ).min(1),
})
export type PerplexityResponse = z.infer<typeof PerplexityResponseSchema>

// Competitor item shape (server → client)
export const CompetitorSchema = z.object({
  name: z.string().min(1),
  reason: z.string().min(1),
})
export const CompetitorsResponseSchema = z.object({
  competitors: z.array(CompetitorSchema),
})
export type CompetitorsResponse = z.infer<typeof CompetitorsResponseSchema>
