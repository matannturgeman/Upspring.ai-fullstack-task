import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Test the schema logic in isolation without importing env.ts directly
// (env.ts calls process.exit(1) on failure, which would kill the test runner)
const EnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  PERPLEXITY_API_KEY: z.string().min(1),
  APIFY_API_TOKEN: z.string().min(1),

  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().optional(),

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

  SCRAPER_PRIORITY: z.string().default('apify'),
  SCRAPINGBEE_API_KEY: z.string().optional(),
  RAPIDAPI_KEY: z.string().optional(),
  RAPIDAPI_HOST: z.string().optional(),

  BRAND_CACHE_TTL_MS: z.coerce.number().int().min(0).default(600_000),
})

const VALID_BASE = {
  MONGODB_URI: 'mongodb://localhost/test',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  PERPLEXITY_API_KEY: 'pplx-test',
  APIFY_API_TOKEN: 'apify-test',
}

describe('EnvSchema', () => {
  describe('required fields', () => {
    it('rejects missing MONGODB_URI', () => {
      const { MONGODB_URI: _, ...rest } = VALID_BASE
      expect(EnvSchema.safeParse(rest).success).toBe(false)
    })

    it('rejects missing ANTHROPIC_API_KEY', () => {
      const { ANTHROPIC_API_KEY: _, ...rest } = VALID_BASE
      expect(EnvSchema.safeParse(rest).success).toBe(false)
    })

    it('rejects missing PERPLEXITY_API_KEY', () => {
      const { PERPLEXITY_API_KEY: _, ...rest } = VALID_BASE
      expect(EnvSchema.safeParse(rest).success).toBe(false)
    })

    it('rejects missing APIFY_API_TOKEN', () => {
      const { APIFY_API_TOKEN: _, ...rest } = VALID_BASE
      expect(EnvSchema.safeParse(rest).success).toBe(false)
    })

    it('rejects empty strings for required fields', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, ANTHROPIC_API_KEY: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('defaults', () => {
    it('defaults PORT to 4000', () => {
      const result = EnvSchema.safeParse(VALID_BASE)
      expect(result.success && result.data.PORT).toBe(4000)
    })

    it('defaults NODE_ENV to development', () => {
      const result = EnvSchema.safeParse(VALID_BASE)
      expect(result.success && result.data.NODE_ENV).toBe('development')
    })

    it('defaults MOCK_LLM to false', () => {
      const result = EnvSchema.safeParse(VALID_BASE)
      expect(result.success && result.data.MOCK_LLM).toBe(false)
    })

    it('defaults MOCK_SCRAPER to false', () => {
      const result = EnvSchema.safeParse(VALID_BASE)
      expect(result.success && result.data.MOCK_SCRAPER).toBe(false)
    })

    it('defaults SCRAPER_PRIORITY to apify', () => {
      const result = EnvSchema.safeParse(VALID_BASE)
      expect(result.success && result.data.SCRAPER_PRIORITY).toBe('apify')
    })

    it('defaults BRAND_CACHE_TTL_MS to 600000', () => {
      const result = EnvSchema.safeParse(VALID_BASE)
      expect(result.success && result.data.BRAND_CACHE_TTL_MS).toBe(600_000)
    })
  })

  describe('type coercion', () => {
    it('coerces PORT string to number', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, PORT: '3000' })
      expect(result.success && result.data.PORT).toBe(3000)
    })

    it('coerces BRAND_CACHE_TTL_MS string to number', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, BRAND_CACHE_TTL_MS: '300000' })
      expect(result.success && result.data.BRAND_CACHE_TTL_MS).toBe(300_000)
    })

    it('transforms MOCK_LLM=true string to boolean true', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, MOCK_LLM: 'true' })
      expect(result.success && result.data.MOCK_LLM).toBe(true)
    })

    it('transforms MOCK_SCRAPER=true string to boolean true', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, MOCK_SCRAPER: 'true' })
      expect(result.success && result.data.MOCK_SCRAPER).toBe(true)
    })

    it('transforms MOCK_LLM=false string to boolean false', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, MOCK_LLM: 'false' })
      expect(result.success && result.data.MOCK_LLM).toBe(false)
    })
  })

  describe('optional fields', () => {
    it('accepts SCRAPINGBEE_API_KEY when provided', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, SCRAPINGBEE_API_KEY: 'bee-key' })
      expect(result.success && result.data.SCRAPINGBEE_API_KEY).toBe('bee-key')
    })

    it('accepts FRONTEND_URL when provided', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, FRONTEND_URL: 'http://localhost:5173' })
      expect(result.success && result.data.FRONTEND_URL).toBe('http://localhost:5173')
    })

    it('FRONTEND_URL undefined when not provided', () => {
      const result = EnvSchema.safeParse(VALID_BASE)
      expect(result.success && result.data.FRONTEND_URL).toBeUndefined()
    })
  })

  describe('validation boundaries', () => {
    it('rejects PORT 0', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, PORT: '0' })
      expect(result.success).toBe(false)
    })

    it('rejects PORT > 65535', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, PORT: '99999' })
      expect(result.success).toBe(false)
    })

    it('rejects invalid NODE_ENV', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, NODE_ENV: 'staging' })
      expect(result.success).toBe(false)
    })

    it('rejects negative BRAND_CACHE_TTL_MS', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, BRAND_CACHE_TTL_MS: '-1' })
      expect(result.success).toBe(false)
    })

    it('accepts BRAND_CACHE_TTL_MS=0 (disables cache)', () => {
      const result = EnvSchema.safeParse({ ...VALID_BASE, BRAND_CACHE_TTL_MS: '0' })
      expect(result.success && result.data.BRAND_CACHE_TTL_MS).toBe(0)
    })
  })
})
