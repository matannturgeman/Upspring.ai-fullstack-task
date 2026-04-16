import Anthropic from '@anthropic-ai/sdk'
import { isMockLLM } from '../utils/mockMode.ts'
import { streamMockAnalysis, streamMockChat } from '../mocks/claudeMock.ts'

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

  async *streamChat(
    brandName: string,
    ads: AdInput[],
    messages: { role: 'user' | 'assistant'; content: string }[]
  ): AsyncGenerator<string> {
    if (isMockLLM()) {
      yield* streamMockChat()
      return
    }

    // Prioritise active ads, cap at 20 for token budget
    const contextAds = [...ads]
      .sort((a, b) => {
        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1
        if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1
        return 0
      })
      .slice(0, 20)

    const adContext = contextAds.map((ad, i) => {
      const hasThumbnail = Boolean(ad.thumbnailUrl || ad.imageUrl)
      const mediaNote = ad.videoUrl
        ? (hasThumbnail ? '[Video — thumbnail analyzed as visual proxy]' : '[Video — no thumbnail; visual analysis limited to copy]')
        : null
      return [
        `--- Ad ${i + 1} ---`,
        `Platform: ${ad.platform} | Status: ${ad.status}`,
        mediaNote,
        ad.headline ? `Headline: ${ad.headline}` : null,
        ad.primaryText ? `Primary Text: ${ad.primaryText.slice(0, 300)}` : null,
      ].filter(Boolean).join('\n')
    }).join('\n\n')

    const system = `You are an AI creative analyst for brand advertising intelligence.
You have access to a curated sample of ${contextAds.length} ads from "${brandName}" \
(${ads.length} total in library — active ads prioritised). \
For video ads, the thumbnail frame is used as a visual proxy where available.

${adContext}

Answer questions analytically with specific examples from these ads. Be concise and actionable.`

    // Inject up to 10 images (thumbnails or stills) into first user message
    const imageUrls = contextAds
      .map(ad => ad.thumbnailUrl || ad.imageUrl)
      .filter((url): url is string => Boolean(url))
      .slice(0, 10)

    type AntMessage = Anthropic.MessageParam
    const anthropicMessages: AntMessage[] = messages.map((m, i) => {
      if (m.role === 'user' && i === 0 && imageUrls.length > 0) {
        return {
          role: 'user',
          content: [
            ...imageUrls.map(url => ({
              type: 'image' as const,
              source: { type: 'url' as const, url },
            })),
            { type: 'text' as const, text: m.content },
          ],
        }
      }
      return { role: m.role, content: m.content }
    })

    const stream = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      stream: true,
      messages: anthropicMessages,
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
    const imageUrl = ad.thumbnailUrl || ad.imageUrl
    const mediaNote = ad.videoUrl
      ? (imageUrl ? 'Media: Video ad — the image above is the thumbnail frame analyzed as a visual proxy.' : 'Media: Video ad — no thumbnail available; visual analysis limited to copy only.')
      : ''
    return [
      'Analyze this Meta ad for a brand intelligence report.',
      '',
      `Platform: ${ad.platform}`,
      `Status: ${ad.status}`,
      mediaNote,
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
