export function isMockLLM(): boolean {
  return process.env.MOCK_LLM === 'true'
}

export function isMockScraper(): boolean {
  return process.env.MOCK_SCRAPER === 'true'
}

/** @deprecated use isMockLLM() */
export const isMockMode = isMockLLM
