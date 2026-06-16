import { useCallback, useEffect, useRef, useState } from 'react'

export type TimerMode = 'focus' | 'break'

export const DEFAULTS: Record<TimerMode, number> = {
  focus: 25 * 60 * 1000,
  break: 5 * 60 * 1000
}

// Duration bounds: 00:01 minimum, 60:60 maximum (60 min + 60 s).
export const MIN_MS = 1000
export const MAX_MS = (60 * 60 + 60) * 1000

export function clampDuration(ms: number): number {
  if (!Number.isFinite(ms)) return MIN_MS
  return Math.max(MIN_MS, Math.min(MAX_MS, Math.round(ms / 1000) * 1000))
}

export interface Timer {
  running: boolean
  mode: TimerMode
  remainingMs: number
  durationMs: number
  fraction: number // 0..1 elapsed
  start: () => void
  pause: () => void
  toggle: () => void
  reset: () => void
  switchMode: (mode: TimerMode) => void
  setDuration: (mode: TimerMode, ms: number) => void
  hydrate: (focusMs: number, breakMs: number) => void
}

interface Options {
  onComplete?: (finished: TimerMode) => void
  onPersist?: (durations: Record<TimerMode, number>) => void
}

// A focus/break countdown kept in the renderer (which stays alive while the
// island is collapsed), so the pill can render its progress and a paused timer
// resumes exactly where it left off after hide/show. Counting is endAt-based so
// background-throttling or system sleep can't drift it.
export function useTimer({ onComplete, onPersist }: Options = {}): Timer {
  const [durations, setDurations] = useState<Record<TimerMode, number>>(DEFAULTS)
  const [mode, setMode] = useState<TimerMode>('focus')
  const [running, setRunning] = useState(false)
  const [remainingMs, setRemainingMs] = useState(DEFAULTS.focus)
  const endAtRef = useRef<number | null>(null)
  const lastLeftRef = useRef<number | null>(null)
  // Refs read inside the interval so it doesn't need to be torn down/recreated on
  // every mode/duration change, and so completion never uses a stale closure.
  const modeRef = useRef(mode)
  modeRef.current = mode
  const durationsRef = useRef(durations)
  durationsRef.current = durations
  const onCompleteRef = useRef(onComplete)
  const onPersistRef = useRef(onPersist)
  onCompleteRef.current = onComplete
  onPersistRef.current = onPersist

  useEffect(() => {
    if (!running) return
    const tick = (): void => {
      // null endAt means we already completed/paused this cycle — never re-enter
      // (prevents double completion if a tick fires before the effect tears down).
      if (endAtRef.current == null) return
      let left = Math.max(0, endAtRef.current - Date.now())
      // A backward wall-clock jump (sleep/wake, NTP correction) would inflate
      // `left` and extend the countdown — re-anchor so it can only ever decrease.
      const prev = lastLeftRef.current
      if (prev != null && left > prev + 1000) {
        endAtRef.current = Date.now() + prev
        left = prev
      }
      lastLeftRef.current = left
      if (left <= 0) {
        endAtRef.current = null
        lastLeftRef.current = null
        const finished = modeRef.current
        const next: TimerMode = finished === 'focus' ? 'break' : 'focus'
        setRunning(false)
        setMode(next)
        setRemainingMs(durationsRef.current[next])
        onCompleteRef.current?.(finished)
        return
      }
      setRemainingMs(left)
    }
    tick()
    const iv = window.setInterval(tick, 250)
    return () => clearInterval(iv)
  }, [running])

  const start = useCallback(() => {
    setRunning((r) => {
      if (r || remainingMs <= 0) return r
      endAtRef.current = Date.now() + remainingMs
      lastLeftRef.current = remainingMs
      return true
    })
  }, [remainingMs])

  const pause = useCallback(() => {
    // Freeze at the true remaining so resume is exact even after throttling.
    if (endAtRef.current != null) setRemainingMs(Math.max(0, endAtRef.current - Date.now()))
    setRunning(false)
    endAtRef.current = null
    lastLeftRef.current = null
  }, [])

  const toggle = useCallback(() => (running ? pause() : start()), [running, pause, start])

  const reset = useCallback(() => {
    setRunning(false)
    endAtRef.current = null
    lastLeftRef.current = null
    setRemainingMs(durations[mode])
  }, [durations, mode])

  const switchMode = useCallback(
    (m: TimerMode) => {
      setRunning(false)
      endAtRef.current = null
      lastLeftRef.current = null
      setMode(m)
      setRemainingMs(durations[m])
    },
    [durations]
  )

  const setDuration = useCallback(
    (m: TimerMode, msRaw: number) => {
      const ms = clampDuration(msRaw)
      setDurations((d) => {
        const next = { ...d, [m]: ms }
        onPersistRef.current?.(next)
        return next
      })
      // Live-reflect only when editing the active, non-running timer.
      setRunning((r) => {
        if (!r && m === mode) {
          endAtRef.current = null
          setRemainingMs(ms)
        }
        return r
      })
    },
    [mode]
  )

  const hydrate = useCallback((focusMs: number, breakMs: number) => {
    const f = clampDuration(focusMs)
    const b = clampDuration(breakMs)
    setDurations({ focus: f, break: b })
    setRunning((r) => {
      if (!r) {
        endAtRef.current = null
        setMode((m) => {
          setRemainingMs(m === 'focus' ? f : b)
          return m
        })
      }
      return r
    })
  }, [])

  const durationMs = durations[mode]
  const fraction = durationMs > 0 ? 1 - remainingMs / durationMs : 0

  return {
    running,
    mode,
    remainingMs,
    durationMs,
    fraction,
    start,
    pause,
    toggle,
    reset,
    switchMode,
    setDuration,
    hydrate
  }
}

export function fmtClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
