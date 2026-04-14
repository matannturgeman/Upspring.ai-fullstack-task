import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AdCard } from '../../src/components/AdCard/AdCard.tsx'
import type { AdDto } from '../../src/types/ad.types.ts'

const baseAd: AdDto = {
  _id: '1',
  brandId: 'brand1',
  platform: 'Facebook',
  status: 'ACTIVE',
  performanceData: null,
  headline: 'Test Headline',
  primaryText: 'Test primary text',
  thumbnailUrl: 'https://img.com/test.jpg',
  startDate: '2024-01-15T00:00:00.000Z',
}

describe('AdCard', () => {
  it('renders headline and primary text', () => {
    render(<AdCard ad={baseAd} />)
    expect(screen.getByText('Test Headline')).toBeInTheDocument()
    expect(screen.getByText('Test primary text')).toBeInTheDocument()
  })

  it('shows Active badge for active ad', () => {
    render(<AdCard ad={baseAd} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows Inactive badge for inactive ad', () => {
    render(<AdCard ad={{ ...baseAd, status: 'INACTIVE' }} />)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('shows performance data unavailable notice', () => {
    render(<AdCard ad={baseAd} />)
    expect(screen.getByText(/performance data unavailable/i)).toBeInTheDocument()
  })

  it('shows "No preview" when no image', () => {
    render(<AdCard ad={{ ...baseAd, thumbnailUrl: undefined, imageUrl: undefined }} />)
    expect(screen.getByText(/no preview/i)).toBeInTheDocument()
  })

  it('shows VIDEO badge when videoUrl present', () => {
    render(<AdCard ad={{ ...baseAd, videoUrl: 'https://vid.com/v.mp4' }} />)
    expect(screen.getByText('VIDEO')).toBeInTheDocument()
  })

  it('shows platform and date', () => {
    render(<AdCard ad={baseAd} />)
    expect(screen.getByText('Facebook')).toBeInTheDocument()
  })
})
