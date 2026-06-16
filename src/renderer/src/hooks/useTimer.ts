import { useCallback, useEffect, useRef, useState } from 'react'

export type TimerMode = 'focus' | 'break'

export const DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60 * 1000,
  break: 5 * 60 * 1000
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
}

// A focus/break countdown kept in the renderer (which stays alive while the
// island is collapsed), so the pill can render its progress at any time.
export function useTimer(onComplete?: (finished: TimerMode) => void): Timer {
  const [mode, setMode] = useState<TimerMode>('focus')
  const [running, setRunning] = useState(false)
  const [remainingMs, setRemainingMs] = useState(DURATIONS.focus)
  const endAtRef = useRef<number | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!running) return
    const tick = (): void => {
      const left = Math.max(0, (endAtRef.current ?? 0) - Date.now())
      setRemainingMs(left)
      if (left <= 0) {
        setRunning(false)
        endAtRef.current = null
        const finished = mode
        const next: TimerMode = mode === 'focus' ? 'break' : 'focus'
        setMode(next)
        setRemainingMs(DURATIONS[next])
        onCompleteRef.current?.(finished)
      }
    }
    const iv = window.setInterval(tick, 250)
    return () => clearInterval(iv)
  }, [running, mode])

  const start = useCallback(() => {
    setRunning((r) => {
      if (r) return r
      endAtRef.current = Date.now() + remainingMs
      return true
    })
  }, [remainingMs])

  const pause = useCallback(() => {
    setRunning(false)
    endAtRef.current = null
  }, [])

  const toggle = useCallback(() => (running ? pause() : start()), [running, pause, start])

  const reset = useCallback(() => {
    setRunning(false)
    endAtRef.current = null
    setRemainingMs(DURATIONS[mode])
  }, [mode])

  const switchMode = useCallback((m: TimerMode) => {
    setRunning(false)
    endAtRef.current = null
    setMode(m)
    setRemainingMs(DURATIONS[m])
  }, [])

  const durationMs = DURATIONS[mode]
  const fraction = durationMs > 0 ? 1 - remainingMs / durationMs : 0

  return { running, mode, remainingMs, durationMs, fraction, start, pause, toggle, reset, switchMode }
}

export function fmtClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
