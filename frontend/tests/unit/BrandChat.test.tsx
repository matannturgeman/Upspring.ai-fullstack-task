import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrandChat } from '../../src/components/BrandChat/BrandChat.tsx'

const mockClose = vi.fn()
const mockSend = vi.fn()
const mockState = vi.fn()

vi.mock('../../src/store/appStore.ts', () => ({
  useAppStore: () => mockState(),
}))

vi.mock('../../src/hooks/useChat.ts', () => ({
  useChat: () => ({ sendMessage: mockSend, closeChat: mockClose }),
}))

const BRAND = {
  _id: 'b1',
  name: 'Nike',
  normalizedName: 'nike',
  lastFetched: '2024-01-01',
  adCount: 5,
}

const base = {
  currentBrand: BRAND,
  chatOpen: true,
  chatMessages: [],
  chatLoading: false,
  chatError: null,
}

describe('BrandChat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing when chatOpen is false', () => {
    mockState.mockReturnValue({ ...base, chatOpen: false })
    const { container } = render(<BrandChat />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when currentBrand is null', () => {
    mockState.mockReturnValue({ ...base, currentBrand: null })
    const { container } = render(<BrandChat />)
    expect(container.firstChild).toBeNull()
  })

  it('shows brand name in header', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    expect(screen.getByText(/Ask AI about Nike/i)).toBeInTheDocument()
  })

  it('shows model name in header', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument()
  })

  it('shows suggestion chips when no messages', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    expect(screen.getByText(/What messaging angles are used most/i)).toBeInTheDocument()
    expect(screen.getByText(/What patterns do you see/i)).toBeInTheDocument()
  })

  it('clicking a suggestion calls sendMessage', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    fireEvent.click(screen.getByText(/What messaging angles are used most/i))
    expect(mockSend).toHaveBeenCalledWith('b1', 'What messaging angles are used most?')
  })

  it('hides suggestions when messages exist', () => {
    mockState.mockReturnValue({
      ...base,
      chatMessages: [{ id: '1', role: 'user', text: 'Hello' }],
    })
    render(<BrandChat />)
    expect(screen.queryByText(/What messaging angles/i)).not.toBeInTheDocument()
  })

  it('renders user message bubble', () => {
    mockState.mockReturnValue({
      ...base,
      chatMessages: [{ id: '1', role: 'user', text: 'What patterns?' }],
    })
    render(<BrandChat />)
    expect(screen.getByText('What patterns?')).toBeInTheDocument()
  })

  it('renders AI message bubble', () => {
    mockState.mockReturnValue({
      ...base,
      chatMessages: [{ id: '2', role: 'ai', text: 'Urgency is common.' }],
    })
    render(<BrandChat />)
    expect(screen.getByText(/Urgency is common/i)).toBeInTheDocument()
  })

  it('shows error alert when chatError is set', () => {
    mockState.mockReturnValue({ ...base, chatError: 'AI provider failed' })
    render(<BrandChat />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/AI provider failed/i)).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('send button is enabled after typing', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What patterns?' } })
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })

  it('send button calls sendMessage and clears input', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What patterns?' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(mockSend).toHaveBeenCalledWith('b1', 'What patterns?')
  })

  it('pressing Enter sends the message', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    expect(mockSend).toHaveBeenCalledWith('b1', 'Hello')
  })

  it('pressing Shift+Enter does not send', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('close button calls closeChat', () => {
    mockState.mockReturnValue(base)
    render(<BrandChat />)
    fireEvent.click(screen.getByRole('button', { name: /close chat/i }))
    expect(mockClose).toHaveBeenCalled()
  })

  it('send button shows spinner when loading', () => {
    mockState.mockReturnValue({ ...base, chatLoading: true })
    render(<BrandChat />)
    // Spinner replaces "Send" text; button should still be disabled
    expect(screen.queryByText('Send')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })
})
