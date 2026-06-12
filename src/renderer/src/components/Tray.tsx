import { useState } from 'react'
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
  const q = query.trim().toLowerCase()
  const filtered = q ? clips.filter((c) => matches(c, q)) : clips
  const pinned = filtered.filter((c) => c.pinned)
  const recent = filtered.filter((c) => !c.pinned)

  return (
    <div className="tray">
      <header className="trayHeader">
        <span className="title">Island Vault</span>
        <span className="count">{clips.length}</span>
      </header>
      <SearchBar value={query} onChange={setQuery} />
      <div className="list">
        {pinned.length > 0 && <div className="sectionLabel">Pinned</div>}
        {pinned.map((c) => (
          <ClipRow key={c.id} clip={c} job={aiJobs[c.id]} onCopy={onCopy} />
        ))}
        {pinned.length > 0 && recent.length > 0 && <div className="sectionLabel">Recent</div>}
        {recent.map((c) => (
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
