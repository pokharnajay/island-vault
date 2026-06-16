import { useCallback, useEffect, useRef, useState } from 'react'
import Tray from './components/Tray'
import { useClips } from './hooks/useClips'
import type { AiJobEvent, ClipMeta, UiMetrics } from '@shared/types'

const HOVER_INTENT_MS = 1000
const LEAVE_GRACE_MS = 350
const EXPANDED_W = 420
const EXPANDED_H = 248

interface Flash {
  msg: string
  kind: 'ok' | 'err'
}

export default function App() {
  const clips = useClips()
  const [expanded, setExpandedState] = useState(false)
  const [metrics, setMetrics] = useState<UiMetrics>({ menuBarHeight: 38, pillWidth: 196 })
  const [flash, setFlash] = useState<Flash | null>(null)
  const [aiJobs, setAiJobs] = useState<Record<number, AiJobEvent>>({})

  const expandedRef = useRef(false)
  const hoverTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const flashTimer = useRef<number | null>(null)

  const showFlash = useCallback((msg: string, kind: Flash['kind']) => {
    if (flashTimer.current != null) clearTimeout(flashTimer.current)
    setFlash({ msg, kind })
    flashTimer.current = window.setTimeout(() => setFlash(null), 1400)
  }, [])

  const expand = useCallback(() => {
    if (expandedRef.current) return
    expandedRef.current = true
    setExpandedState(true)
    void window.vault.setExpanded(true)
  }, [])

  const collapse = useCallback(() => {
    if (leaveTimer.current != null) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
    if (!expandedRef.current) return
    expandedRef.current = false
    setExpandedState(false)
    void window.vault.setExpanded(false)
  }, [])

  // Metrics, collapse pushes, AI job events, Escape
  useEffect(() => {
    void window.vault.metrics().then(setMetrics)
    const offCollapse = window.vault.onCollapse(() => {
      void window.vault.metrics().then(setMetrics)
      collapse()
    })
    const offAi = window.vault.onAiJob((ev) => {
      if (ev.status === 'running') {
        setAiJobs((prev) => ({ ...prev, [ev.sourceClipId]: ev }))
        return
      }
      setAiJobs((prev) => {
        const next = { ...prev }
        delete next[ev.sourceClipId]
        return next
      })
      if (ev.status === 'done') showFlash('AI result copied', 'ok')
      else showFlash(ev.message ?? 'AI action failed', 'err')
    })
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') collapse()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      offCollapse()
      offAi()
      window.removeEventListener('keydown', onKey)
    }
  }, [collapse, showFlash])

  // Hover-intent while collapsed. With ignoreMouseEvents(forward) only mousemove
  // reaches the page, so hit-test coordinates against the pill rect ourselves.
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (expandedRef.current) return
      const pillLeft = (window.innerWidth - metrics.pillWidth) / 2
      const inside =
        e.clientY <= metrics.menuBarHeight + 2 &&
        e.clientX >= pillLeft &&
        e.clientX <= pillLeft + metrics.pillWidth
      if (inside) {
        if (hoverTimer.current == null) {
          hoverTimer.current = window.setTimeout(() => {
            hoverTimer.current = null
            expand()
          }, HOVER_INTENT_MS)
        }
      } else if (hoverTimer.current != null) {
        clearTimeout(hoverTimer.current)
        hoverTimer.current = null
      }
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [metrics, expand])

  const startLeave = useCallback(() => {
    if (!expandedRef.current) return
    if (leaveTimer.current != null) clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null
      collapse()
    }, LEAVE_GRACE_MS)
  }, [collapse])

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current != null) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }, [])

  const handleCopy = useCallback(
    async (clip: ClipMeta) => {
      const res = await window.vault.copyClip(clip.id)
      if (res.ok) {
        showFlash('Copied', 'ok')
        collapse()
      } else {
        showFlash(res.reason === 'missing-file' ? 'File no longer exists' : 'Item unavailable', 'err')
      }
    },
    [collapse, showFlash]
  )

  const islandStyle: React.CSSProperties = expanded
    ? { width: EXPANDED_W, height: EXPANDED_H }
    : { width: metrics.pillWidth, height: metrics.menuBarHeight }

  return (
    <div
      className="root"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) collapse()
      }}
    >
      <div
        className={`island ${expanded ? 'expanded' : ''}`}
        style={islandStyle}
        onMouseEnter={cancelLeave}
        onMouseLeave={startLeave}
      >
        <div className="pillContent">{!expanded && flash ? flash.msg : ''}</div>
        <div className="trayContent">
          <Tray clips={clips} aiJobs={aiJobs} onCopy={handleCopy} active={expanded} />
        </div>
        {expanded && flash && <div className={`flashChip ${flash.kind}`}>{flash.msg}</div>}
      </div>
    </div>
  )
}
