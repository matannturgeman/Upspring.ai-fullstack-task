import { BaseScraper, type ScrapeOptions, type ScrapeResult } from './BaseScraper'
import { mockScrapeMetaAds } from '../mocks/apifyMock'

export class MockScraper extends BaseScraper {
  readonly name = 'mock'

  async scrape(brandName: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    return mockScrapeMetaAds(brandName, options)
  }
}
