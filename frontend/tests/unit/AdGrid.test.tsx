import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AdGrid } from '../../src/components/AdGrid/AdGrid.tsx'

const mockState = vi.fn()

vi.mock('../../src/store/appStore.ts', () => ({
  useAppStore: () => mockState(),
}))

describe('AdGrid', () => {
  it('shows skeleton when loading', () => {
    mockState.mockReturnValue({
      ads: [],
      adsLoading: true,
      adsError: null,
      adsEmpty: false,
      fromCache: false,
    })
    render(<AdGrid />)
    expect(screen.getAllByTestId('skeleton-card').length).toBeGreaterThan(0)
  })

  it('shows error state', () => {
    mockState.mockReturnValue({
      ads: [],
      adsLoading: false,
      adsError: 'Something went wrong',
      adsEmpty: false,
      fromCache: false,
    })
    render(<AdGrid />)
    expect(screen.getAllByText(/something went wrong/i).length).toBeGreaterThan(0)
  })

  it('shows empty state', () => {
    mockState.mockReturnValue({
      ads: [],
      adsLoading: false,
      adsError: null,
      adsEmpty: true,
      fromCache: false,
    })
    render(<AdGrid />)
    expect(screen.getByText(/no ads found/i)).toBeInTheDocument()
  })

  it('shows cache badge when fromCache is true', () => {
    mockState.mockReturnValue({
      ads: [
        { _id: '1', brandId: 'b1', platform: 'Facebook', status: 'ACTIVE', performanceData: null },
      ],
      adsLoading: false,
      adsError: null,
      adsEmpty: false,
      fromCache: true,
    })
    render(<AdGrid />)
    expect(screen.getByText(/cached/i)).toBeInTheDocument()
  })

  it('renders nothing when no ads and no state', () => {
    mockState.mockReturnValue({
      ads: [],
      adsLoading: false,
      adsError: null,
      adsEmpty: false,
      fromCache: false,
    })
    const { container } = render(<AdGrid />)
    expect(container.firstChild).toBeNull()
  })
})
