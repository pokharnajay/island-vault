import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaControlAction, NowPlaying as NP } from '@shared/types'

function fmt(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`
}

export default function NowPlaying({ active }: { active: boolean }) {
  const [np, setNp] = useState<NP | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [artErr, setArtErr] = useState<string | null>(null)
  const posBase = useRef<{ pos: number; at: number } | null>(null)
  const [, force] = useState(0)

  const poll = useCallback(async () => {
    const r = await window.vault.nowPlaying()
    setNp(r)
    setLoaded(true)
    posBase.current = r?.positionMs != null ? { pos: r.positionMs, at: Date.now() } : null
  }, [])

  // Poll only while this tab is visible to avoid constant osascript spawns.
  useEffect(() => {
    if (!active) return
    void poll()
    const iv = window.setInterval(poll, 1500)
    return () => clearInterval(iv)
  }, [active, poll])

  // Smoothly advance the scrubber between polls.
  useEffect(() => {
    if (!active || !np?.playing) return
    const iv = window.setInterval(() => force((n) => n + 1), 500)
    return () => clearInterval(iv)
  }, [active, np?.playing])

  const control = useCallback(
    async (action: MediaControlAction) => {
      await window.vault.mediaControl(action)
      window.setTimeout(poll, 350)
    },
    [poll]
  )

  if (!loaded) return <div className="npEmpty">…</div>
  if (!np) {
    return (
      <div className="npEmpty">
        <div className="npEmptyGlyph">♪</div>
        Nothing playing
        <span className="npHint">Spotify or Apple Music</span>
      </div>
    )
  }

  const pos =
    np.playing && posBase.current
      ? posBase.current.pos + (Date.now() - posBase.current.at)
      : (np.positionMs ?? 0)
  const dur = np.durationMs ?? 0
  const frac = dur > 0 ? Math.max(0, Math.min(1, pos / dur)) : 0

  return (
    <div className="np">
      <div className="npArt">
        {np.artworkUrl && artErr !== np.artworkUrl ? (
          <img
            src={np.artworkUrl}
            alt=""
            draggable={false}
            onError={() => setArtErr(np.artworkUrl ?? null)}
          />
        ) : (
          <div className="npArtFallback">♪</div>
        )}
      </div>
      <div className="npInfo">
        <div className="npTitle" title={np.title}>
          {np.title ?? 'Unknown'}
        </div>
        <div className="npArtist" title={np.artist}>
          {np.artist ?? np.app}
        </div>

        <div className="npBar">
          <div className="npBarFill" style={{ width: `${frac * 100}%` }} />
        </div>
        {dur > 0 && (
          <div className="npTimes">
            <span>{fmt(pos)}</span>
            <span>{fmt(dur)}</span>
          </div>
        )}

        <div className="npControls">
          <button className="npBtn" onClick={() => control('prev')} title="Previous">
            ⏮
          </button>
          <button className="npBtn play" onClick={() => control('playpause')}>
            {np.playing ? '⏸' : '▶'}
          </button>
          <button className="npBtn" onClick={() => control('next')} title="Next">
            ⏭
          </button>
        </div>
      </div>
    </div>
  )
}
