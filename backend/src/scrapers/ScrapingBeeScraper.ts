import { BaseScraper, type ScrapeOptions, type ScrapeResult } from './BaseScraper.ts'

// Uses ScrapingBee as a proxy to hit the Meta Ads Library async endpoint.
// Required env: SCRAPINGBEE_API_KEY
// Docs: https://www.scrapingbee.com/documentation/
export class ScrapingBeeScraper extends BaseScraper {
  readonly name = 'scrapingbee'

  async scrape(brandName: string, { limit = 20 }: ScrapeOptions = {}): Promise<ScrapeResult> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY
    if (!apiKey) throw new Error('SCRAPINGBEE_API_KEY not set')

    const targetUrl = [
      'https://www.facebook.com/ads/library/async/search_ads/',
      `?q=${encodeURIComponent(brandName)}`,
      `&count=${limit}`,
      '&active_status=all&ad_type=all&countries[0]=US',
      '&search_type=keyword_unordered&media_type=all',
    ].join('')

    const params = new URLSearchParams({
      api_key: apiKey,
      url: targetUrl,
      render_js: 'false',
      premium_proxy: 'true',
      country_code: 'us',
    })

    const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`)

    if (!res.ok) {
      throw new Error(`ScrapingBee returned ${res.status}: ${await res.text()}`)
    }

    const raw = await res.text()

    // Facebook's async endpoint prefixes the JSON with "for (;;);" — strip it
    const json = raw.replace(/^for\s*\(;;\);/, '').trim()
    const data = JSON.parse(json) as Record<string, unknown>

    const payload = (data.payload as Record<string, unknown>) ?? {}
    const results = (payload.results as Record<string, unknown>[]) ?? []

    if (results.length === 0) return { ads: [], partial: false, empty: true, scraper: this.name }

    const ads = results.map(r => ({
      id: r.adArchiveID ?? r.adid,
      page_name: r.pageName ?? brandName,
      ad_creative_bodies: (r.snapshot as Record<string, unknown>)?.body
        ? [((r.snapshot as Record<string, unknown>).body as Record<string, unknown>).markup ?? '']
        : [],
      ad_creative_link_titles: [],
      ad_creative_link_captions: [],
      ad_delivery_start_time: r.startDate ?? null,
      ad_delivery_stop_time: r.endDate ?? null,
      publisher_platforms: (r.publisherPlatform as string[]) ?? [],
      images: (r.snapshot as Record<string, unknown>)?.images ?? [],
      videos: (r.snapshot as Record<string, unknown>)?.videos ?? [],
      status: r.isActive ? 'ACTIVE' : 'INACTIVE',
    }))

    return { ads, partial: ads.length < limit, empty: false, scraper: this.name }
  }
}
