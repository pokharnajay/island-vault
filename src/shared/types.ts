export type ClipType = 'text' | 'image' | 'files'

export interface ClipFileRef {
  path: string
  name: string
  exists: boolean
}

export interface ClipMeta {
  id: number
  type: ClipType
  preview: string
  pinned: boolean
  createdAt: number
  lastCopiedAt: number
  byteSize: number
  thumbUrl?: string
  imageSize?: { w: number; h: number }
  files?: ClipFileRef[]
}

export type AiAction = 'cleanup' | 'summarize' | 'translate' | 'extract'

export interface AiJobEvent {
  jobId: number
  sourceClipId: number
  action: AiAction
  status: 'running' | 'done' | 'error'
  newClipId?: number
  message?: string
}

export interface Settings {
  historyCap: number
  launchAtLogin: boolean
  translateTarget: string
  claudePath?: string
  aiModel?: string
}

export interface CopyResult {
  ok: boolean
  reason?: 'missing-file' | 'gone'
}

export interface UiMetrics {
  menuBarHeight: number
  pillWidth: number
}

export type MediaApp = 'Spotify' | 'Music'
export type MediaControlAction = 'playpause' | 'next' | 'prev'

export interface NowPlaying {
  app: MediaApp
  playing: boolean
  title?: string
  artist?: string
  album?: string
  artworkUrl?: string
  durationMs?: number
  positionMs?: number
}
