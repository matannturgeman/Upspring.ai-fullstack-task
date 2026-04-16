import { describe, it, expect } from 'vitest'
import { codeExtract } from '../../src/services/extraction/codeExtractor.ts'

describe('codeExtract', () => {
  it('parses a full raw ad correctly', () => {
    const raw = {
      id: 'abc123',
      publisher_platforms: ['FACEBOOK', 'INSTAGRAM'],
      is_active: true,
      start_date: 1700000000,
      snapshot: {
        title: 'Big Sale',
        body: { text: 'Shop now!' },
        images: [{ url: 'https://example.com/img.jpg' }],
        videos: [],
      },
    }
    const ad = codeExtract(raw)
    expect(ad?.adId).toBe('abc123')
    expect(ad?.headline).toBe('Big Sale')
    expect(ad?.primaryText).toBe('Shop now!')
    expect(ad?.status).toBe('ACTIVE')
    expect(ad?.imageUrl).toBe('https://example.com/img.jpg')
    expect(ad?.startDate).toBeInstanceOf(Date)
  })

  it('handles missing snapshot fields gracefully', () => {
    const raw = { id: 'x', publisher_platforms: [], is_active: false, snapshot: {} }
    const ad = codeExtract(raw)
    expect(ad?.headline).toBeUndefined()
    expect(ad?.primaryText).toBeUndefined()
    expect(ad?.imageUrl).toBeUndefined()
    expect(ad?.status).toBe('INACTIVE')
  })

  it('handles completely missing snapshot', () => {
    const ad = codeExtract({ id: 'y' })
    expect(ad?.adId).toBe('y')
    expect(ad?.headline).toBeUndefined()
    expect(ad?.imageUrl).toBeUndefined()
    expect(ad?.status).toBe('UNKNOWN')
  })

  it('prefers video thumbnail over image', () => {
    const raw = {
      id: 'v1',
      snapshot: {
        images: [{ url: 'https://img.com/static.jpg' }],
        videos: [{ video_preview_image_url: 'https://img.com/thumb.jpg', video_hd_url: 'https://vid.com/hd.mp4' }],
      },
    }
    const ad = codeExtract(raw)
    expect(ad?.thumbnailUrl).toBe('https://img.com/thumb.jpg')
    expect(ad?.videoUrl).toBe('https://vid.com/hd.mp4')
  })

  it('falls back to sd video url when hd missing', () => {
    const raw = {
      id: 'v2',
      snapshot: {
        videos: [{ video_sd_url: 'https://vid.com/sd.mp4' }],
      },
    }
    const ad = codeExtract(raw)
    expect(ad?.videoUrl).toBe('https://vid.com/sd.mp4')
  })

  it('joins multiple platforms', () => {
    const raw = { id: 'p1', publisher_platforms: ['FACEBOOK', 'INSTAGRAM', 'AUDIENCE_NETWORK'] }
    const ad = codeExtract(raw)
    expect(ad?.platform).toBe('FACEBOOK, INSTAGRAM, AUDIENCE_NETWORK')
  })

  it('defaults platform when empty', () => {
    const ad = codeExtract({ id: 'p2', publisher_platforms: [] })
    expect(ad?.platform).toBe('Facebook/Instagram')
  })

  it('returns null for non-object input', () => {
    expect(codeExtract(null)).toBeNull()
    expect(codeExtract('string')).toBeNull()
    expect(codeExtract(42)).toBeNull()
  })
})
