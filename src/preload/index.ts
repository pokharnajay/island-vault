import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { VaultApi } from '@shared/api'
import type { AiJobEvent, ClipMeta } from '@shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: VaultApi = {
  listClips: () => ipcRenderer.invoke(IPC.ClipsList),
  copyClip: (id) => ipcRenderer.invoke(IPC.ClipsCopy, id),
  pinClip: (id, pinned) => ipcRenderer.invoke(IPC.ClipsPin, { id, pinned }),
  deleteClip: (id) => ipcRenderer.invoke(IPC.ClipsDelete, id),
  clearClips: (keepPinned) => ipcRenderer.invoke(IPC.ClipsClear, { keepPinned }),
  setExpanded: (expanded) => ipcRenderer.invoke(IPC.UiSetExpanded, expanded),
  contextMenu: (id) => ipcRenderer.invoke(IPC.UiContextMenu, { id }),
  metrics: () => ipcRenderer.invoke(IPC.UiMetrics),
  aiAvailability: () => ipcRenderer.invoke(IPC.AiAvailability),
  getSettings: () => ipcRenderer.invoke(IPC.SettingsGet),
  setSettings: (patch) => ipcRenderer.invoke(IPC.SettingsSet, patch),
  onClipsChanged: (cb) => subscribe<ClipMeta[]>(IPC.ClipsChanged, cb),
  onAiJob: (cb) => subscribe<AiJobEvent>(IPC.AiJob, cb),
  onCollapse: (cb) => subscribe<void>(IPC.UiCollapse, () => cb())
}

contextBridge.exposeInMainWorld('vault', api)
