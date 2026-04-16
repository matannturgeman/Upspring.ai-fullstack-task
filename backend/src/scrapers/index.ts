import { BaseScraper, type ScrapeOptions, type ScrapeResult } from './BaseScraper.ts'
import { ApifyScraper } from './ApifyScraper.ts'
import { ScrapingBeeScraper } from './ScrapingBeeScraper.ts'
import { RapidApiScraper } from './RapidApiScraper.ts'
import { MockScraper } from './MockScraper.ts'
import { isMockScraper } from '../utils/mockMode.ts'

export type { ScrapeResult, ScrapeOptions }

const registry: Record<string, BaseScraper> = {
  apify: new ApifyScraper(),
  scrapingbee: new ScrapingBeeScraper(),
  rapidapi: new RapidApiScraper(),
}

const mockScraper = new MockScraper()

export async function scrapeMetaAds(
  brandName: string,
  options?: ScrapeOptions
): Promise<ScrapeResult> {
  if (isMockScraper()) return mockScraper.scrape(brandName, options)

  const priority = (process.env.SCRAPER_PRIORITY ?? 'apify')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const scrapers = priority.map(name => registry[name]).filter(Boolean)

  if (scrapers.length === 0) {
    throw new Error(`No valid scrapers in SCRAPER_PRIORITY="${process.env.SCRAPER_PRIORITY}". Valid: ${Object.keys(registry).join(', ')}`)
  }

  const errors: string[] = []
  for (const scraper of scrapers) {
    try {
      console.log(`[scraper] trying ${scraper.name}`)
      return await scraper.scrape(brandName, options)
    } catch (err) {
      const msg = (err as Error).message
      console.warn(`[scraper:${scraper.name}] failed: ${msg}`)
      errors.push(`${scraper.name}: ${msg}`)
    }
  }

  throw new Error(`All scrapers failed:\n${errors.join('\n')}`)
}
