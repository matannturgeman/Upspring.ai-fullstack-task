import { ApifyClient } from 'apify-client'
import { BaseScraper, type ScrapeOptions, type ScrapeResult } from './BaseScraper.ts'
import { env } from '../config/env.ts'

const ACTOR_ID = 'apify/facebook-ads-scraper'
const TIMEOUT_SECS = 120

export class ApifyScraper extends BaseScraper {
  readonly name = 'apify'
  private readonly client: ApifyClient

  constructor() {
    super()
    this.client = new ApifyClient({ token: env.APIFY_API_TOKEN })
  }

  async scrape(brandName: string, { limit = 20 }: ScrapeOptions = {}): Promise<ScrapeResult> {
    const run = await this.client.actor(ACTOR_ID).call(
      {
        searchTerms: [brandName],
        maxAdsCount: limit,
        adType: 'ALL',
        publisherPlatforms: ['FACEBOOK', 'INSTAGRAM'],
      },
      { timeout: TIMEOUT_SECS }
    )

    const { items } = await this.client.dataset(run.defaultDatasetId).listItems()

    if (!items || items.length === 0) {
      return { ads: [], partial: false, empty: true, scraper: this.name }
    }

    return {
      ads: items as Record<string, unknown>[],
      partial: items.length < limit,
      empty: false,
      scraper: this.name,
    }
  }
}
