import { ApifyClient } from 'apify-client'
import { isMockMode } from '../utils/mockMode.ts'
import { mockScrapeMetaAds } from '../mocks/apifyMock.ts'

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN })

const ACTOR_ID = 'apify/facebook-ads-scraper'
const TIMEOUT_SECS = 120

export type ScrapeResult = {
  ads: Record<string, unknown>[]
  partial: boolean
  empty: boolean
}

export async function scrapeMetaAds(
  brandName: string,
  { limit = 20 }: { limit?: number } = {}
): Promise<ScrapeResult> {
  if (isMockMode()) return mockScrapeMetaAds(brandName, { limit })

  const run = await client.actor(ACTOR_ID).call(
    {
      searchTerms: [brandName],
      maxAdsCount: limit,
      adType: 'ALL',
      publisherPlatforms: ['FACEBOOK', 'INSTAGRAM'],
    },
    { timeout: TIMEOUT_SECS }
  )

  const { items } = await client.dataset(run.defaultDatasetId).listItems()

  if (!items || items.length === 0) {
    return { ads: [], partial: false, empty: true }
  }

  return {
    ads: items as Record<string, unknown>[],
    partial: items.length < limit,
    empty: false,
  }
}
