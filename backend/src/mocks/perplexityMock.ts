const MOCK_COMPETITORS: Record<string, { name: string; reason: string }[]> = {
  nike: [
    { name: 'Adidas', reason: 'Direct competitor in athletic footwear and apparel' },
    { name: 'Under Armour', reason: 'Competes in performance sportswear segment' },
    { name: 'New Balance', reason: 'Overlapping audience in running and lifestyle shoes' },
    { name: 'Puma', reason: 'Shared focus on sport and street culture' },
    { name: 'Reebok', reason: 'Classic rivalry in fitness and training gear' },
  ],
  apple: [
    { name: 'Samsung', reason: 'Primary rival in smartphones and consumer electronics' },
    { name: 'Google', reason: 'Competes in OS ecosystem, hardware, and AI services' },
    { name: 'Microsoft', reason: 'Overlapping in laptops, productivity, and enterprise' },
    { name: 'Sonos', reason: 'Competes in premium audio and smart home' },
    { name: 'Spotify', reason: 'Rival in music streaming and podcast distribution' },
  ],
}

const DEFAULT_COMPETITORS = [
  { name: 'Market Leader A', reason: 'Dominant player in the same vertical with overlapping ad strategy' },
  { name: 'Challenger Brand B', reason: 'Aggressively targeting the same audience segments on Meta' },
  { name: 'Niche Competitor C', reason: 'Strong overlap in product category and pricing tier' },
  { name: 'Emerging Rival D', reason: 'Fast-growing brand with similar positioning and creative style' },
  { name: 'Legacy Brand E', reason: 'Established competitor with high brand recall in the same market' },
]

export async function mockFindCompetitors(brandName: string): Promise<{ name: string; reason: string }[]> {
  await new Promise(r => setTimeout(r, 600))
  return MOCK_COMPETITORS[brandName.toLowerCase()] ?? DEFAULT_COMPETITORS
}
