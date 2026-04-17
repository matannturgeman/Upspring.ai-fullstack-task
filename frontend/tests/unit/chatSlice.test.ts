import { describe, it, expect } from 'vitest'
import { createStore } from 'zustand'
import { createChatSlice, type ChatSlice } from '../../src/store/slices/chatSlice.ts'

function makeStore() {
  return createStore<ChatSlice>((...a) => createChatSlice(...a))
}

describe('chatSlice', () => {
  it('starts with closed chat and empty messages', () => {
    const store = makeStore()
    const s = store.getState()
    expect(s.chatOpen).toBe(false)
    expect(s.chatMessages).toEqual([])
    expect(s.chatLoading).toBe(false)
    expect(s.chatError).toBeNull()
  })

  it('setChatOpen toggles chat visibility', () => {
    const store = makeStore()
    store.getState().setChatOpen(true)
    expect(store.getState().chatOpen).toBe(true)
    store.getState().setChatOpen(false)
    expect(store.getState().chatOpen).toBe(false)
  })

  it('addChatMessage appends to chatMessages', () => {
    const store = makeStore()
    const msg = { id: '1', role: 'user' as const, text: 'Hello' }
    store.getState().addChatMessage(msg)
    expect(store.getState().chatMessages).toHaveLength(1)
    expect(store.getState().chatMessages[0]).toEqual(msg)
  })

  it('addChatMessage preserves order', () => {
    const store = makeStore()
    store.getState().addChatMessage({ id: '1', role: 'user', text: 'Q' })
    store.getState().addChatMessage({ id: '2', role: 'ai', text: 'A' })
    const ids = store.getState().chatMessages.map((m) => m.id)
    expect(ids).toEqual(['1', '2'])
  })

  it('updateChatMessage updates text and streaming flag by id', () => {
    const store = makeStore()
    store.getState().addChatMessage({ id: 'ai-1', role: 'ai', text: '', streaming: true })
    store.getState().updateChatMessage('ai-1', 'Partial answer', true)
    expect(store.getState().chatMessages[0].text).toBe('Partial answer')
    expect(store.getState().chatMessages[0].streaming).toBe(true)
    store.getState().updateChatMessage('ai-1', 'Full answer', false)
    expect(store.getState().chatMessages[0].streaming).toBe(false)
  })

  it('updateChatMessage does not mutate other messages', () => {
    const store = makeStore()
    store.getState().addChatMessage({ id: '1', role: 'user', text: 'Original' })
    store.getState().addChatMessage({ id: '2', role: 'ai', text: '' })
    store.getState().updateChatMessage('2', 'Response', false)
    expect(store.getState().chatMessages[0].text).toBe('Original')
  })

  it('clearChatMessages empties the array', () => {
    const store = makeStore()
    store.getState().addChatMessage({ id: '1', role: 'user', text: 'Hi' })
    store.getState().clearChatMessages()
    expect(store.getState().chatMessages).toEqual([])
  })

  it('setChatLoading sets loading flag', () => {
    const store = makeStore()
    store.getState().setChatLoading(true)
    expect(store.getState().chatLoading).toBe(true)
    store.getState().setChatLoading(false)
    expect(store.getState().chatLoading).toBe(false)
  })

  it('setChatError sets and clears error', () => {
    const store = makeStore()
    store.getState().setChatError('Something went wrong')
    expect(store.getState().chatError).toBe('Something went wrong')
    store.getState().setChatError(null)
    expect(store.getState().chatError).toBeNull()
  })
})
