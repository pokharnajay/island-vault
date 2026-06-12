import type { AiJobEvent, ClipMeta, CopyResult, Settings, UiMetrics } from './types'

export interface VaultApi {
  listClips(): Promise<ClipMeta[]>
  copyClip(id: number): Promise<CopyResult>
  pinClip(id: number, pinned: boolean): Promise<void>
  deleteClip(id: number): Promise<void>
  clearClips(keepPinned: boolean): Promise<void>
  setExpanded(expanded: boolean): Promise<void>
  contextMenu(id: number): Promise<void>
  metrics(): Promise<UiMetrics>
  aiAvailability(): Promise<{ ok: boolean; path?: string }>
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  onClipsChanged(cb: (clips: ClipMeta[]) => void): () => void
  onAiJob(cb: (ev: AiJobEvent) => void): () => void
  onCollapse(cb: () => void): () => void
}
