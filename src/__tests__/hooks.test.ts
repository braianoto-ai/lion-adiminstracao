import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CLOUD_BUS, SYNC_STATUS, SYNC_ERRORS } from '../context'

// Mock supabase as null so hooks work in offline/local mode
vi.mock('../lib/supabase', () => ({ supabase: null }))

import { useSyncStatus, useSyncError, useCloudTable } from '../hooks'

// ─── useSyncStatus ───

describe('useSyncStatus', () => {
  beforeEach(() => {
    SYNC_STATUS.clear()
  })

  it('returns false when no keys are syncing', () => {
    const { result } = renderHook(() => useSyncStatus('lion-txs'))
    expect(result.current).toBe(false)
  })

  it('returns true when a tracked key starts syncing', () => {
    const { result } = renderHook(() => useSyncStatus('lion-txs'))
    act(() => {
      SYNC_STATUS.set('lion-txs', true)
      CLOUD_BUS.dispatchEvent(new Event('lion-txs:status'))
    })
    expect(result.current).toBe(true)
  })

  it('returns false when syncing finishes', () => {
    SYNC_STATUS.set('lion-txs', true)
    const { result } = renderHook(() => useSyncStatus('lion-txs'))
    act(() => {
      SYNC_STATUS.set('lion-txs', true)
      CLOUD_BUS.dispatchEvent(new Event('lion-txs:status'))
    })
    expect(result.current).toBe(true)
    act(() => {
      SYNC_STATUS.set('lion-txs', false)
      CLOUD_BUS.dispatchEvent(new Event('lion-txs:status'))
    })
    expect(result.current).toBe(false)
  })

  it('tracks multiple keys — true if any is syncing', () => {
    const { result } = renderHook(() => useSyncStatus('lion-txs', 'lion-goals'))
    act(() => {
      SYNC_STATUS.set('lion-goals', true)
      CLOUD_BUS.dispatchEvent(new Event('lion-goals:status'))
    })
    expect(result.current).toBe(true)
  })

  it('ignores events for untracked keys', () => {
    const { result } = renderHook(() => useSyncStatus('lion-txs'))
    act(() => {
      SYNC_STATUS.set('lion-goals', true)
      CLOUD_BUS.dispatchEvent(new Event('lion-goals:status'))
    })
    expect(result.current).toBe(false)
  })
})

// ─── useSyncError ───

describe('useSyncError', () => {
  beforeEach(() => {
    SYNC_ERRORS.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when no error', () => {
    const { result } = renderHook(() => useSyncError())
    expect(result.current).toBeNull()
  })

  it('returns error message when sync:error fires', () => {
    const { result } = renderHook(() => useSyncError())
    act(() => {
      CLOUD_BUS.dispatchEvent(new CustomEvent('sync:error', { detail: 'Falha ao salvar' }))
    })
    expect(result.current).toBe('Falha ao salvar')
  })

  it('clears error automatically after 8 seconds', () => {
    const { result } = renderHook(() => useSyncError())
    act(() => {
      CLOUD_BUS.dispatchEvent(new CustomEvent('sync:error', { detail: 'Erro temporário' }))
    })
    expect(result.current).toBe('Erro temporário')
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(result.current).toBeNull()
  })

  it('returns null when sync:error fires with null detail', () => {
    const { result } = renderHook(() => useSyncError())
    act(() => {
      CLOUD_BUS.dispatchEvent(new CustomEvent('sync:error', { detail: null }))
    })
    expect(result.current).toBeNull()
  })
})

// ─── useCloudTable ───

describe('useCloudTable (offline mode, supabase=null)', () => {
  const LS_KEY = 'test-table-key'

  beforeEach(() => {
    window.localStorage.removeItem(LS_KEY)
  })

  it('initializes with empty array when localStorage is empty', () => {
    const { result } = renderHook(() => useCloudTable<{ id: string; name: string }>('test_table', LS_KEY))
    expect(result.current[0]).toEqual([])
  })

  it('initializes from localStorage', () => {
    const initial = [{ id: '1', name: 'Item 1' }]
    localStorage.setItem(LS_KEY, JSON.stringify(initial))
    const { result } = renderHook(() => useCloudTable<{ id: string; name: string }>('test_table', LS_KEY))
    expect(result.current[0]).toEqual(initial)
  })

  it('setData updates state and localStorage', () => {
    const { result } = renderHook(() => useCloudTable<{ id: string; name: string }>('test_table', LS_KEY))
    const newItems = [{ id: '1', name: 'Novo' }]
    act(() => {
      result.current[1](newItems)
    })
    expect(result.current[0]).toEqual(newItems)
    expect(JSON.parse(localStorage.getItem(LS_KEY) || '[]')).toEqual(newItems)
  })

  it('setData with function updater works', () => {
    const initial = [{ id: '1', name: 'A' }]
    localStorage.setItem(LS_KEY, JSON.stringify(initial))
    const { result } = renderHook(() => useCloudTable<{ id: string; name: string }>('test_table', LS_KEY))
    act(() => {
      result.current[1](prev => [...prev, { id: '2', name: 'B' }])
    })
    expect(result.current[0]).toHaveLength(2)
    expect(result.current[0][1]).toEqual({ id: '2', name: 'B' })
  })

  it('emits CLOUD_BUS event on setData', () => {
    const { result } = renderHook(() => useCloudTable<{ id: string; name: string }>('test_table', LS_KEY))
    const spy = vi.fn()
    CLOUD_BUS.addEventListener(LS_KEY, spy)
    act(() => {
      result.current[1]([{ id: '1', name: 'Test' }])
    })
    expect(spy).toHaveBeenCalled()
    CLOUD_BUS.removeEventListener(LS_KEY, spy)
  })

  it('responds to CLOUD_BUS events from other tabs', () => {
    const { result } = renderHook(() => useCloudTable<{ id: string; name: string }>('test_table', LS_KEY))
    const externalData = [{ id: '99', name: 'External' }]
    act(() => {
      localStorage.setItem(LS_KEY, JSON.stringify(externalData))
      CLOUD_BUS.dispatchEvent(new Event(LS_KEY))
    })
    expect(result.current[0]).toEqual(externalData)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(LS_KEY, 'not-valid-json')
    const { result } = renderHook(() => useCloudTable<{ id: string; name: string }>('test_table', LS_KEY))
    expect(result.current[0]).toEqual([])
  })
})
