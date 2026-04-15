import Anthropic from '@anthropic-ai/sdk'
import { isMockMode } from '../utils/mockMode.ts'
import { streamMockAnalysis } from '../mocks/claudeMock.ts'

interface AdInput {
  platform: string
  status: string
  headline?: string
  primaryText?: string
  imageUrl?: string
  videoUrl?: string
  thumbnailUrl?: string
}

export async function* streamAnalysis(ad: AdInput): AsyncGenerator<string> {
  if (isMockMode()) {
    yield* streamMockAnalysis()
    return
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const imageUrl = ad.thumbnailUrl || ad.imageUrl

  type ContentBlock = Anthropic.ImageBlockParam | Anthropic.TextBlockParam

  const content: ContentBlock[] = []

  if (imageUrl) {
    content.push({ type: 'image', source: { type: 'url', url: imageUrl } })
  }

  content.push({ type: 'text', text: buildPrompt(ad) })

  const stream = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    stream: true,
    messages: [{ role: 'user', content }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }
  }
}

function buildPrompt(ad: AdInput): string {
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
  ].filter(l => l !== undefined).join('\n')
}
