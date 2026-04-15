import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AnalysisPanel } from '../../src/components/AnalysisPanel/AnalysisPanel.tsx'

const mockState = vi.fn()

vi.mock('../../src/store/appStore.ts', () => ({
  useAppStore: () => mockState(),
}))

vi.mock('../../src/hooks/useAnalysis.ts', () => ({
  useAnalysis: () => ({ analyze: vi.fn(), close: vi.fn() }),
}))

const base = {
  selectedAdId: null,
  analysisMessages: [],
  analysisLoading: false,
  analysisError: null,
}

describe('AnalysisPanel', () => {
  it('renders nothing when no ad selected', () => {
    mockState.mockReturnValue(base)
    const { container } = render(<AnalysisPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('shows panel when ad is selected', () => {
    mockState.mockReturnValue({ ...base, selectedAdId: 'ad1' })
    render(<AnalysisPanel />)
    expect(screen.getByText('AI Ad Analysis')).toBeInTheDocument()
  })

  it('shows loading state when loading with no text', () => {
    mockState.mockReturnValue({ ...base, selectedAdId: 'ad1', analysisLoading: true })
    render(<AnalysisPanel />)
    expect(screen.getByText(/analyzing ad/i)).toBeInTheDocument()
  })

  it('shows error state', () => {
    mockState.mockReturnValue({ ...base, selectedAdId: 'ad1', analysisError: 'Provider failed' })
    render(<AnalysisPanel />)
    expect(screen.getByText('Provider failed')).toBeInTheDocument()
  })

  it('renders streamed text', () => {
    mockState.mockReturnValue({
      ...base,
      selectedAdId: 'ad1',
      analysisMessages: [{ id: 1, role: 'ai', text: 'Great ad copy.', streaming: false }],
    })
    render(<AnalysisPanel />)
    expect(screen.getByText(/great ad copy/i)).toBeInTheDocument()
  })
})
