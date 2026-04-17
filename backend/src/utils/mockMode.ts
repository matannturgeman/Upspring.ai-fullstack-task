import { env } from '../config/env.ts'

export function isMockLLM(): boolean {
  return env.MOCK_LLM
}

export function isMockScraper(): boolean {
  return env.MOCK_SCRAPER
}

/** @deprecated use isMockLLM() */
export const isMockMode = isMockLLM
