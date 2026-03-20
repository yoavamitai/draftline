import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAppStore } from './useAppStore'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getState().getInitialState())
  })

  it('starts with no file, clean, dark theme', () => {
    const { result } = renderHook(() => useAppStore())
    expect(result.current.filePath).toBeNull()
    expect(result.current.isDirty).toBe(false)
    expect(result.current.theme).toBe('dark')
  })

  it('toggles theme', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('light')
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('toggles sidebar', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.toggleSidebar())
    expect(result.current.sidebarOpen).toBe(false) // starts true
  })

  it('advances revision color in WGA sequence', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.nextRevisionDraft('Blue pages'))
    expect(result.current.revisionColor).toBe('blue')
    expect(result.current.revisionDraftName).toBe('Blue pages')
  })
})
