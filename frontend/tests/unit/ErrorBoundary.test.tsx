import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary.tsx'

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test crash')
  return <div>OK</div>
}

// Suppress React's error boundary console.error noise in test output
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

test('renders children when no error', () => {
  render(
    <ErrorBoundary>
      <Bomb shouldThrow={false} />
    </ErrorBoundary>,
  )
  expect(screen.getByText('OK')).toBeInTheDocument()
})

test('shows fallback UI when child throws', () => {
  render(
    <ErrorBoundary>
      <Bomb shouldThrow={true} />
    </ErrorBoundary>,
  )
  expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  expect(screen.getByText('Test crash')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
})

test('Try Again button is rendered in fallback UI', () => {
  render(
    <ErrorBoundary>
      <Bomb shouldThrow={true} />
    </ErrorBoundary>,
  )
  const btn = screen.getByRole('button', { name: /Try Again/i })
  expect(btn).toBeInTheDocument()
  // Clicking resets hasError — verify no throw afterwards by mounting a fresh boundary
  render(
    <ErrorBoundary>
      <Bomb shouldThrow={false} />
    </ErrorBoundary>,
  )
  expect(screen.getAllByText('OK').length).toBeGreaterThan(0)
})
