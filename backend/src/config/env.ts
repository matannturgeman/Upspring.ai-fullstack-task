import { config } from 'dotenv'
import { z } from 'zod'

config()

const EnvSchema = z.object({
  // Required
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  PERPLEXITY_API_KEY: z.string().min(1, 'PERPLEXITY_API_KEY is required'),
  APIFY_API_TOKEN: z.string().min(1, 'APIFY_API_TOKEN is required'),

  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().optional(),

  // Feature flags
  MOCK_LLM: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  MOCK_SCRAPER: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),

  // Scraper config
  SCRAPER_PRIORITY: z.string().default('apify'),
  SCRAPINGBEE_API_KEY: z.string().optional(),
  RAPIDAPI_KEY: z.string().optional(),
  RAPIDAPI_HOST: z.string().optional(),

  // Cache
  BRAND_CACHE_TTL_MS: z.coerce.number().int().min(0).default(600_000),
  COMPETITOR_CACHE_TTL_MS: z.coerce.number().int().min(0).default(600_000),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('[env] Invalid environment variables:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const env = parsed.data

export type Env = typeof env

// no-op: validation happens at import time
export function validateEnv(): void {}
