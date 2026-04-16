import type { ScrapeResult } from '../scrapers/BaseScraper.ts'

const MOCK_ADS: Record<string, unknown>[] = [
  {
    id: 'mock_ad_001',
    snapshot_url: null,
    page_name: 'Nike',
    ad_creative_bodies: ['Just Do It. Shop the latest Nike collection.'],
    ad_creative_link_captions: ['nike.com'],
    ad_creative_link_titles: ['Nike — Just Do It'],
    ad_delivery_start_time: '2024-01-15',
    ad_delivery_stop_time: null,
    publisher_platforms: ['facebook', 'instagram'],
    ad_snapshot_url: null,
    images: [],
    videos: [],
    status: 'ACTIVE',
  },
  {
    id: 'mock_ad_002',
    snapshot_url: null,
    page_name: 'Nike',
    ad_creative_bodies: ['New Arrivals: Air Max 2024. Comfort meets performance.'],
    ad_creative_link_captions: ['nike.com/air-max'],
    ad_creative_link_titles: ['Nike Air Max — New Collection'],
    ad_delivery_start_time: '2024-02-01',
    ad_delivery_stop_time: null,
    publisher_platforms: ['facebook'],
    ad_snapshot_url: null,
    images: [],
    videos: [],
    status: 'ACTIVE',
  },
  {
    id: 'mock_ad_003',
    snapshot_url: null,
    page_name: 'Nike',
    ad_creative_bodies: ['Train harder. Recover faster. Nike Pro collection.'],
    ad_creative_link_captions: ['nike.com/pro'],
    ad_creative_link_titles: ['Nike Pro — Performance Gear'],
    ad_delivery_start_time: '2024-03-10',
    ad_delivery_stop_time: null,
    publisher_platforms: ['instagram'],
    ad_snapshot_url: null,
    images: [],
    videos: [],
    status: 'ACTIVE',
  },
]

export async function mockScrapeMetaAds(
  brandName: string,
  { limit = 20 }: { limit?: number } = {},
): Promise<ScrapeResult> {
  await new Promise(r => setTimeout(r, 800))
  const ads = MOCK_ADS.slice(0, limit).map(ad => ({
    ...ad,
    page_name: brandName,
    ad_creative_link_titles: [(ad as { ad_creative_link_titles: string[] }).ad_creative_link_titles[0].replace('Nike', brandName)],
  }))
  return { ads, partial: false, empty: false, scraper: 'mock' }
}
