import { BaseScraper, type ScrapeOptions, type ScrapeResult } from './BaseScraper.ts'
import { ApifyScraper } from './ApifyScraper.ts'
import { ScrapingBeeScraper } from './ScrapingBeeScraper.ts'
import { RapidApiScraper } from './RapidApiScraper.ts'
import { MockScraper } from './MockScraper.ts'
import { isMockScraper } from '../utils/mockMode.ts'

export class ScraperRegistry {
  private readonly registry: Record<string, BaseScraper> = {
    apify: new ApifyScraper(),
    scrapingbee: new ScrapingBeeScraper(),
    rapidapi: new RapidApiScraper(),
  }

  private readonly mock = new MockScraper()

  async scrape(brandName: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    if (isMockScraper()) return this.mock.scrape(brandName, options)

    const priority = (process.env.SCRAPER_PRIORITY ?? 'apify')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const scrapers = priority.map(name => this.registry[name]).filter(Boolean)

    if (scrapers.length === 0) {
      throw new Error(
        `No valid scrapers in SCRAPER_PRIORITY="${process.env.SCRAPER_PRIORITY}". Valid: ${Object.keys(this.registry).join(', ')}`
      )
    }

    const errors: string[] = []
    for (const scraper of scrapers) {
      try {
        console.log(`[ScraperRegistry] trying ${scraper.name}`)
        return await scraper.scrape(brandName, options)
      } catch (err) {
        const msg = (err as Error).message
        console.warn(`[ScraperRegistry:${scraper.name}] failed: ${msg}`)
        errors.push(`${scraper.name}: ${msg}`)
      }
    }

    throw new Error(`All scrapers failed:\n${errors.join('\n')}`)
  }
}
