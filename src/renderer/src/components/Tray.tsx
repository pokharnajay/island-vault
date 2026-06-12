import { useEffect, useRef, useState } from 'react'
import SearchBar from './SearchBar'
import ClipRow from './ClipRow'
import type { AiJobEvent, ClipMeta } from '@shared/types'

interface Props {
  clips: ClipMeta[]
  aiJobs: Record<number, AiJobEvent>
  onCopy: (clip: ClipMeta) => void
  active: boolean
}

interface AppFilter {
  bundleId: string
  name: string
}

export default function Tray({ clips, aiJobs, onCopy, active }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClipMeta[] | null>(null)
  const [appFilter, setAppFilter] = useState<AppFilter | null>(null)
  const [selected, setSelected] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)
  const searchToken = useRef(0)

  const q = query.trim()

  // Full-text search runs main-side over the whole stored content
  useEffect(() => {
    if (!q) {
      setResults(null)
      return
    }
    const token = ++searchToken.current
    const t = window.setTimeout(() => {
      void window.vault.searchClips(q).then((r) => {
        if (searchToken.current === token) setResults(r)
      })
    }, 120)
    return () => clearTimeout(t)
  }, [q])

  const base = results ?? clips
  const shown = appFilter ? base.filter((c) => c.sourceApp?.bundleId === appFilter.bundleId) : base

  // Keep selection valid and visible
  useEffect(() => {
    setSelected(0)
  }, [q, appFilter, shown.length])

  useEffect(() => {
    const el = stripRef.current?.children[selected] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest' })
  }, [selected])

  // Mouse wheels scroll vertically — translate to horizontal strip movement.
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ←/→ navigate, Enter copies. Arrows still move the caret while typing a query.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      const inSearch =
        document.activeElement instanceof HTMLInputElement && document.activeElement.value !== ''
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (inSearch) return
        e.preventDefault()
        setSelected((s) =>
          Math.max(0, Math.min(shown.length - 1, s + (e.key === 'ArrowRight' ? 1 : -1)))
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const clip = shown[selected]
        if (clip) onCopy(clip)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, shown, selected, onCopy])

  return (
    <div className="tray">
      <header className="trayHeader">
        <span className="title">Island Vault</span>
        {appFilter ? (
          <button className="filterChip" onClick={() => setAppFilter(null)}>
            {appFilter.name} ✕
          </button>
        ) : (
          <span className="count">{clips.length}</span>
        )}
      </header>
      <SearchBar value={query} onChange={setQuery} />
      <div className="strip" ref={stripRef}>
        {shown.map((c, i) => (
          <ClipRow
            key={c.id}
            clip={c}
            job={aiJobs[c.id]}
            onCopy={onCopy}
            selected={i === selected}
            onAppClick={(bundleId, name) => setAppFilter({ bundleId, name })}
          />
        ))}
        {shown.length === 0 && (
          <div className="empty">
            {clips.length === 0 ? 'Copy something to get started' : 'No matches'}
          </div>
        )}
      </div>
    </div>
  )
}
