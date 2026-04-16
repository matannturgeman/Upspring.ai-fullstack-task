import Anthropic from '@anthropic-ai/sdk'
import { searchCompetitors } from './perplexityService.ts'
import { mockFindCompetitors } from '../mocks/perplexityMock.ts'
import { isMockMode } from '../utils/mockMode.ts'
import Ad from '../models/Ad.ts'

export async function findCompetitors(
  brandName: string,
  brandId: string,
): Promise<{ competitors: { name: string; reason: string }[]; source: string }> {
  if (isMockMode()) {
    return { competitors: await mockFindCompetitors(brandName), source: 'mock' }
  }

  // Strategy 1: Perplexity web search
  try {
    const competitors = await searchCompetitors(brandName)
    if (competitors.length > 0) return { competitors, source: 'perplexity' }
  } catch (err) {
    console.warn('Perplexity failed, falling back to Claude:', (err as Error).message)
  }

  // Strategy 2: Claude reasoning from ad content
  const ads = await Ad.find({ brandId }).lean().limit(10)
  const adContext = ads
    .map(a => `${a.headline ?? ''} ${a.primaryText ?? ''}`.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Based on brand "${brandName}" and their ad copy below, identify 5 direct competitors.
Return JSON only: [{ "name": "...", "reason": "one sentence why they compete" }]

Ad copy:
${adContext}`,
    }],
  })

  const text = (response.content[0] as { type: string; text: string }).text
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Could not identify competitors')
  return { competitors: JSON.parse(match[0]) as { name: string; reason: string }[], source: 'claude' }
}
