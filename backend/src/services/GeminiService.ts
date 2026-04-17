import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { isMockLLM } from '../utils/mockMode'
import { streamMockAnalysis } from '../mocks/claudeMock'
import { env } from '../config/env'
import type { AdInput } from './ClaudeService'
import fetch from 'node-fetch'

export class GeminiService {
  async *streamAnalysis(ad: AdInput): AsyncGenerator<string> {
    if (isMockLLM()) {
      yield* streamMockAnalysis()
      return
    }

    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not set')
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
    const fileManager = new GoogleAIFileManager(env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // 1. Download video and write to temp file (uploadFile expects a file path)
    const resp = await fetch(ad.videoUrl!)
    if (!resp.ok) throw new Error(`Failed to fetch video: ${resp.status}`)
    const tmpPath = join(tmpdir(), `ad-video-${Date.now()}.mp4`)
    writeFileSync(tmpPath, Buffer.from(await resp.arrayBuffer()))

    // 2. Upload to Gemini Files API
    let uploaded
    try {
      ;({ file: uploaded } = await fileManager.uploadFile(tmpPath, {
        mimeType: 'video/mp4',
        displayName: `ad-${Date.now()}`,
      }))
    } finally {
      try { unlinkSync(tmpPath) } catch { /* best-effort cleanup */ }
    }

    // 3. Poll until ACTIVE (max 30s)
    let file = uploaded
    let waited = 0
    while (file.state === 'PROCESSING' && waited < 30_000) {
      await new Promise((r) => setTimeout(r, 2000))
      waited += 2000
      file = await fileManager.getFile(file.name)
    }
    if (file.state !== 'ACTIVE') {
      throw new Error(`Gemini file not ACTIVE: ${file.state}`)
    }

    // 4. Stream analysis
    const result = await model.generateContentStream([
      { fileData: { mimeType: 'video/mp4', fileUri: file.uri } },
      { text: buildVideoPrompt(ad) },
    ])

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) yield text
    }

    // 5. Cleanup (best-effort, don't block response)
    fileManager.deleteFile(file.name).catch(() => {})
  }
}

function buildVideoPrompt(ad: AdInput): string {
  return [
    'Analyze this Meta video ad for a brand intelligence report.',
    `Platform: ${ad.platform} | Status: ${ad.status}`,
    'Media: Full video analyzed.',
    ad.headline ? `Headline: ${ad.headline}` : '',
    ad.primaryText ? `Primary Text: ${ad.primaryText}` : '',
    '',
    'Provide structured analysis:',
    '1. **Hook & Attention** — what makes someone stop scrolling',
    '2. **Visual Strategy** — how the creative supports the message',
    '3. **Copy Structure** — tone, brevity, persuasion technique',
    '4. **Target Audience** — who this ad is optimized for',
    '5. **Call to Action** — CTA effectiveness',
    '6. **Overall Assessment** — strengths and what could be improved',
    '',
    'Be concise, specific, and actionable.',
  ]
    .filter(Boolean)
    .join('\n')
}
