export type ScrapeResult = {
  ads: Record<string, unknown>[]
  partial: boolean
  empty: boolean
  scraper: string
}

export interface ScrapeOptions {
  limit?: number
}

export abstract class BaseScraper {
  abstract readonly name: string
  abstract scrape(brandName: string, options?: ScrapeOptions): Promise<ScrapeResult>

  protected log(msg: string): void {
    console.log(`[${this.name}] ${msg}`)
  }

  protected warn(msg: string): void {
    console.warn(`[${this.name}] ${msg}`)
  }
}
