import { useEffect, useRef, useState } from 'react'
import SearchBar from './SearchBar'
import ClipRow from './ClipRow'
import type { AiJobEvent, ClipMeta } from '@shared/types'

interface Props {
  clips: ClipMeta[]
  aiJobs: Record<number, AiJobEvent>
  onCopy: (clip: ClipMeta) => void
}

function matches(c: ClipMeta, q: string): boolean {
  if (c.preview.toLowerCase().includes(q)) return true
  return c.files?.some((f) => f.name.toLowerCase().includes(q)) ?? false
}

export default function Tray({ clips, aiJobs, onCopy }: Props) {
  const [query, setQuery] = useState('')
  const stripRef = useRef<HTMLDivElement>(null)
  const q = query.trim().toLowerCase()
  const filtered = q ? clips.filter((c) => matches(c, q)) : clips

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

  return (
    <div className="tray">
      <header className="trayHeader">
        <span className="title">Island Vault</span>
        <span className="count">{clips.length}</span>
      </header>
      <SearchBar value={query} onChange={setQuery} />
      <div className="strip" ref={stripRef}>
        {filtered.map((c) => (
          <ClipRow key={c.id} clip={c} job={aiJobs[c.id]} onCopy={onCopy} />
        ))}
        {filtered.length === 0 && (
          <div className="empty">
            {clips.length === 0 ? 'Copy something to get started' : 'No matches'}
          </div>
        )}
      </div>
    </div>
  )
}
