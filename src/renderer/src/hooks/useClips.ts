import { useEffect, useState } from 'react'
import type { ClipMeta } from '@shared/types'

export function useClips(): ClipMeta[] {
  const [clips, setClips] = useState<ClipMeta[]>([])

  useEffect(() => {
    let alive = true
    void window.vault
      .listClips()
      .then((c) => {
        if (alive) setClips(c)
      })
      .catch(() => {
        /* window torn down before response */
      })
    const off = window.vault.onClipsChanged(setClips)
    return () => {
      alive = false
      off()
    }
  }, [])

  return clips
}
