import type { AiAction, AiJobEvent, ClipMeta } from '@shared/types'

interface Props {
  clip: ClipMeta
  job?: AiJobEvent
  onCopy: (clip: ClipMeta) => void
}

function fmtAgo(ts: number): string {
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function typeLabel(c: ClipMeta): string {
  if (c.type === 'image') {
    return c.imageSize ? `${c.imageSize.w}×${c.imageSize.h}` : 'Image'
  }
  if (c.type === 'files') {
    const n = c.files?.length ?? 0
    return n === 1 ? 'File' : `${n} files`
  }
  return 'Text'
}

const ACTION_LABEL: Record<AiAction, string> = {
  cleanup: 'Cleaning up…',
  summarize: 'Summarizing…',
  translate: 'Translating…',
  extract: 'Extracting…'
}

export default function ClipRow({ clip, job, onCopy }: Props) {
  const missing = clip.type === 'files' && (clip.files?.some((f) => !f.exists) ?? false)

  const fileNames =
    clip.type === 'files' && clip.files
      ? clip.files
          .slice(0, 2)
          .map((f) => f.name)
          .join(', ') + (clip.files.length > 2 ? ` +${clip.files.length - 2}` : '')
      : ''

  return (
    <div
      className={`row ${missing ? 'missing' : ''}`}
      onClick={() => {
        if (!missing) onCopy(clip)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        void window.vault.contextMenu(clip.id)
      }}
    >
      {clip.type === 'text' && <p className="rowText">{clip.preview}</p>}
      {clip.type === 'image' && (
        <img className="rowImg" src={clip.thumbUrl} alt={clip.preview} draggable={false} />
      )}
      {clip.type === 'files' && <p className="rowText">{fileNames}</p>}
      <div className="rowMeta">
        {clip.pinned && <span className="pinBadge">★</span>}
        <span>{typeLabel(clip)}</span>
        <span>·</span>
        <span>{fmtAgo(clip.lastCopiedAt)}</span>
        {job?.status === 'running' && (
          <span className="aiBadge">
            <span className="spinner" /> {ACTION_LABEL[job.action]}
          </span>
        )}
        {missing && <span className="missingBadge">missing</span>}
      </div>
      <button
        className="pinBtn"
        title={clip.pinned ? 'Unpin' : 'Pin'}
        onClick={(e) => {
          e.stopPropagation()
          void window.vault.pinClip(clip.id, !clip.pinned)
        }}
      >
        {clip.pinned ? '★' : '☆'}
      </button>
    </div>
  )
}
