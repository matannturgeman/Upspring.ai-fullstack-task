import { env } from '../config/env.ts'

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'

export class PerplexityService {
  async searchCompetitors(brandName: string): Promise<{ name: string; reason: string }[]> {
    const prompt = `Who are the top 5 direct competitors of the brand "${brandName}"?
List only real brand names that run paid ads on Facebook/Instagram.
For each competitor, explain in one sentence why they compete with ${brandName}.
Return JSON: [{ "name": "...", "reason": "..." }]
Only return the JSON array, no other text.`

    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) throw new Error(`Perplexity error: ${response.status}`)

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content ?? ''

    const match = content.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array in Perplexity response')
    return JSON.parse(match[0]) as { name: string; reason: string }[]
  }
}
