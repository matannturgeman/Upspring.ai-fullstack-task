import Anthropic from '@anthropic-ai/sdk'
import { isMockLLM } from '../utils/mockMode.ts'
import { streamMockAnalysis } from '../mocks/claudeMock.ts'

export interface AdInput {
  platform: string
  status: string
  headline?: string
  primaryText?: string
  imageUrl?: string
  videoUrl?: string
  thumbnailUrl?: string
}

export class ClaudeService {
  private readonly client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  async *streamAnalysis(ad: AdInput): AsyncGenerator<string> {
    if (isMockLLM()) {
      yield* streamMockAnalysis()
      return
    }

    const imageUrl = ad.thumbnailUrl || ad.imageUrl
    type ContentBlock = Anthropic.ImageBlockParam | Anthropic.TextBlockParam
    const content: ContentBlock[] = []

    if (imageUrl) {
      content.push({ type: 'image', source: { type: 'url', url: imageUrl } })
    }
    content.push({ type: 'text', text: this.buildPrompt(ad) })

    const stream = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      stream: true,
      messages: [{ role: 'user', content }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }

  async extractFields(rawData: unknown): Promise<Record<string, unknown> | null> {
    const system = `Extract ad fields from raw social media ad API data.
Return ONLY a JSON object (omit fields you cannot find):
{ "adId": string, "platform": string, "headline": string, "primaryText": string,
  "imageUrl": string, "videoUrl": string, "thumbnailUrl": string,
  "startDate": string (ISO 8601), "status": "ACTIVE"|"INACTIVE"|"UNKNOWN" }
No explanation. JSON only.`

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: JSON.stringify(rawData, null, 2).slice(0, 4000) }],
      })
      const text = (response.content[0] as { type: string; text: string }).text
      const match = text.match(/\{[\s\S]*\}/)
      return match ? (JSON.parse(match[0]) as Record<string, unknown>) : null
    } catch (err) {
      console.warn('[ClaudeService.extractFields] failed:', (err as Error).message)
      return null
    }
  }

  async findCompetitorsFromAds(brandName: string, adContext: string): Promise<{ name: string; reason: string }[]> {
    const response = await this.client.messages.create({
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
    return JSON.parse(match[0]) as { name: string; reason: string }[]
  }

  private buildPrompt(ad: AdInput): string {
    return [
      'Analyze this Meta ad for a brand intelligence report.',
      '',
      `Platform: ${ad.platform}`,
      `Status: ${ad.status}`,
      ad.headline ? `Headline: ${ad.headline}` : '',
      ad.primaryText ? `Primary Text: ${ad.primaryText}` : '',
      '',
      'Provide a structured analysis covering:',
      '1. **Hook & Attention** — what makes someone stop scrolling',
      '2. **Visual Strategy** — how the creative supports the message',
      '3. **Copy Structure** — tone, brevity, persuasion technique',
      '4. **Target Audience** — who this ad is likely optimized for',
      '5. **Call to Action** — effectiveness of the CTA',
      '6. **Overall Assessment** — strengths and what could be improved',
      '',
      'Be concise, specific, and actionable.',
    ].filter(Boolean).join('\n')
  }
}
