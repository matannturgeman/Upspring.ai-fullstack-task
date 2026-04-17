import { describe, it, expect } from 'vitest'
import { isAllowedUrl } from '../../src/utils/imageProxy'

describe('isAllowedUrl (SSRF allowlist)', () => {
  // HTTP blocked
  it('rejects http:// URLs', () => {
    expect(isAllowedUrl('http://scontent.cdninstagram.com/image.jpg')).toBe(false)
  })

  // Private / internal IPs blocked
  it('rejects localhost', () => {
    expect(isAllowedUrl('https://localhost/secret')).toBe(false)
  })

  it('rejects 127.0.0.1', () => {
    expect(isAllowedUrl('https://127.0.0.1/secret')).toBe(false)
  })

  it('rejects 192.168.x.x', () => {
    expect(isAllowedUrl('https://192.168.1.1/secret')).toBe(false)
  })

  it('rejects 10.x.x.x internal IPs', () => {
    expect(isAllowedUrl('https://10.0.0.1/admin')).toBe(false)
  })

  it('rejects 0.0.0.0', () => {
    expect(isAllowedUrl('https://0.0.0.0/admin')).toBe(false)
  })

  // Unknown domains blocked
  it('rejects unknown domains', () => {
    expect(isAllowedUrl('https://evil.com/image.jpg')).toBe(false)
  })

  it('rejects malformed strings', () => {
    expect(isAllowedUrl('not-a-url')).toBe(false)
    expect(isAllowedUrl('')).toBe(false)
  })

  it('rejects data: URIs', () => {
    expect(isAllowedUrl('data:image/png;base64,abc')).toBe(false)
  })

  // Allowlist explicit hosts
  it('allows scontent.cdninstagram.com', () => {
    expect(isAllowedUrl('https://scontent.cdninstagram.com/v/image.jpg')).toBe(true)
  })

  it('allows lookaside.fbsbx.com', () => {
    expect(isAllowedUrl('https://lookaside.fbsbx.com/photo.jpg')).toBe(true)
  })

  // fbcdn.net pattern
  it('allows subdomains of fbcdn.net', () => {
    expect(isAllowedUrl('https://scontent.fbcdn.net/img.jpg')).toBe(true)
    expect(isAllowedUrl('https://video.fbcdn.net/vid.mp4')).toBe(true)
    expect(isAllowedUrl('https://z-m-scontent.fvie1-1.fna.fbcdn.net/img.jpg')).toBe(true) // in explicit ALLOWED_HOSTS
  })

  it('allows fbcdn.net itself', () => {
    expect(isAllowedUrl('https://fbcdn.net/img.jpg')).toBe(true)
  })

  // apify.com pattern
  it('allows apify.com CDN subdomains', () => {
    expect(isAllowedUrl('https://cdn.apify.com/img.jpg')).toBe(true)
    expect(isAllowedUrl('https://storage.apify.com/img.jpg')).toBe(true)
  })

  it('allows apify.com itself', () => {
    expect(isAllowedUrl('https://apify.com/image.jpg')).toBe(true)
  })

  // Bypass attempts
  it('rejects lookalike domains (fbcdn.net.evil.com)', () => {
    expect(isAllowedUrl('https://fbcdn.net.evil.com/img.jpg')).toBe(false)
  })

  it('rejects apify.com.attacker.io', () => {
    expect(isAllowedUrl('https://apify.com.attacker.io/img.jpg')).toBe(false)
  })
})
