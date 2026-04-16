import { z } from 'zod'

// Loose — raw scraper output varies per provider, partial data is acceptable
export const RawAdDataSchema = z.record(z.string(), z.unknown())

export type RawAdData = z.infer<typeof RawAdDataSchema>
