import { config } from 'dotenv'

config() // load .env before anything checks process.env

const required = ['MONGODB_URI', 'APIFY_API_TOKEN', 'ANTHROPIC_API_KEY', 'PERPLEXITY_API_KEY']

export function validateEnv(): void {
  const missing = required.filter(key => !process.env[key])
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`)
}
