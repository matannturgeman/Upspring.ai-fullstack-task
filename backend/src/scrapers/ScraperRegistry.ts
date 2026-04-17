import { BaseScraper, type ScrapeOptions, type ScrapeResult } from './BaseScraper'
import { ApifyScraper } from './ApifyScraper'
import { ScrapingBeeScraper } from './ScrapingBeeScraper'
import { RapidApiScraper } from './RapidApiScraper'
import { MockScraper } from './MockScraper'
import { isMockScraper } from '../utils/mockMode'
import { env } from '../config/env'

const SCRAPER_FACTORIES: Record<string, () => BaseScraper> = {
  apify: () => new ApifyScraper(),
  scrapingbee: () => new ScrapingBeeScraper(),
  rapidapi: () => new RapidApiScraper(),
}

export class ScraperRegistry {
  private readonly scrapers: BaseScraper[]
  private readonly mock = new MockScraper()

  constructor() {
    const names = env.SCRAPER_PRIORITY.split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    this.scrapers = names.flatMap((name) => {
      const factory = SCRAPER_FACTORIES[name]
      if (!factory) {
        console.warn(`[ScraperRegistry] unknown scraper "${name}", skipping`)
        return []
      }
      try {
        return [factory()]
      } catch (err) {
        console.warn(`[ScraperRegistry] failed to init "${name}": ${(err as Error).message}`)
        return []
      }
    })

    if (this.scrapers.length === 0) {
      throw new Error(
        `No valid scrapers configured in SCRAPER_PRIORITY="${env.SCRAPER_PRIORITY}". Valid: ${Object.keys(SCRAPER_FACTORIES).join(', ')}`,
      )
    }
  }

  async scrape(brandName: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    if (isMockScraper()) return this.mock.scrape(brandName, options)

    const scrapers = this.scrapers

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
