import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchBar } from '../../src/components/SearchBar/SearchBar.tsx'

const mockSearch = vi.fn()

vi.mock('../../src/hooks/useAds.ts', () => ({
  useAds: () => ({ search: mockSearch }),
}))

vi.mock('../../src/store/appStore.ts', () => ({
  useAppStore: (sel: (s: { adsLoading: boolean }) => unknown) => sel({ adsLoading: false }),
}))

beforeEach(() => mockSearch.mockClear())

describe('SearchBar', () => {
  it('renders input and button', () => {
    render(<SearchBar />)
    expect(screen.getByPlaceholderText(/brand name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('disables button when input is empty', () => {
    render(<SearchBar />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('enables button when input has value', () => {
    render(<SearchBar />)
    fireEvent.change(screen.getByPlaceholderText(/brand name/i), { target: { value: 'Nike' } })
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('calls search on form submit', () => {
    render(<SearchBar />)
    fireEvent.change(screen.getByPlaceholderText(/brand name/i), { target: { value: 'Nike' } })
    fireEvent.submit(screen.getByRole('button').closest('form')!)
    expect(mockSearch).toHaveBeenCalledWith('Nike')
  })

  it('trims whitespace before calling search', () => {
    render(<SearchBar />)
    fireEvent.change(screen.getByPlaceholderText(/brand name/i), { target: { value: '  Nike  ' } })
    fireEvent.submit(screen.getByRole('button').closest('form')!)
    expect(mockSearch).toHaveBeenCalledWith('Nike')
  })
})
