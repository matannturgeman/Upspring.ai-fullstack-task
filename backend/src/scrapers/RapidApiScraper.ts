import { BaseScraper, type ScrapeOptions, type ScrapeResult } from './BaseScraper'
import { env } from '../config/env'

// Uses RapidAPI's Facebook Ads Library endpoint.
// Required env: RAPIDAPI_KEY, RAPIDAPI_HOST (e.g. "facebook-ads-library.p.rapidapi.com")
// Find a host at: https://rapidapi.com/search/facebook+ads+library
export class RapidApiScraper extends BaseScraper {
  readonly name = 'rapidapi'
  private readonly apiKey: string
  private readonly apiHost: string

  constructor() {
    super()
    if (!env.RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY not set')
    if (!env.RAPIDAPI_HOST) throw new Error('RAPIDAPI_HOST not set')
    this.apiKey = env.RAPIDAPI_KEY
    this.apiHost = env.RAPIDAPI_HOST
  }

  async scrape(brandName: string, { limit = 20 }: ScrapeOptions = {}): Promise<ScrapeResult> {
    const url = new URL(`https://${this.apiHost}/ads`)
    url.searchParams.set('q', brandName)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('country', 'US')
    url.searchParams.set('ad_type', 'ALL')
    url.searchParams.set('active_status', 'ALL')

    const res = await fetch(url.toString(), {
      headers: {
        'x-rapidapi-key': this.apiKey,
        'x-rapidapi-host': this.apiHost,
      },
    })

    if (!res.ok) {
      throw new Error(`RapidAPI returned ${res.status}: ${await res.text()}`)
    }

    const data = (await res.json()) as Record<string, unknown>

    // Most RapidAPI Facebook Ads endpoints wrap results in data.ads or data.results
    const items =
      (data.ads as Record<string, unknown>[]) ??
      (data.results as Record<string, unknown>[]) ??
      (Array.isArray(data) ? (data as Record<string, unknown>[]) : [])

    if (items.length === 0) return { ads: [], partial: false, empty: true, scraper: this.name }

    const ads = items.map((r) => ({
      id: r.ad_archive_id ?? r.id,
      page_name: r.page_name ?? brandName,
      ad_creative_bodies: r.ad_creative_bodies ?? (r.body ? [r.body] : []),
      ad_creative_link_titles: r.ad_creative_link_titles ?? [],
      ad_creative_link_captions: r.ad_creative_link_captions ?? [],
      ad_delivery_start_time: r.ad_delivery_start_time ?? r.start_date ?? null,
      ad_delivery_stop_time: r.ad_delivery_stop_time ?? r.end_date ?? null,
      publisher_platforms: r.publisher_platforms ?? [],
      images: r.images ?? [],
      videos: r.videos ?? [],
      status: r.status ?? (r.is_active ? 'ACTIVE' : 'INACTIVE'),
    }))

    return { ads, partial: ads.length < limit, empty: false, scraper: this.name }
  }
}
