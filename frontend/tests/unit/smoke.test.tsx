import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../../src/App.tsx'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(document.body).toBeTruthy()
  })
})
