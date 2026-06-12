import { ipcMain } from 'electron'
import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { IPC } from '@shared/ipc-channels'
import type { AiAction, AiJobEvent, CopyResult, Settings, UiMetrics } from '@shared/types'
import * as store from './store'
import * as blobs from './blob-store'
import { writeFilesClip, writeImageClip, writeTextClip } from './clipboard-writer'
import { getWindow, menuBarHeight, PILL_W, setExpanded } from './overlay-window'
import { popupClipMenu } from './context-menu'
import { aiAvailable, enqueue, onJobEvent, resolveClaude } from './ai-runner'
import { getSettings, setSettings } from './settings'

export function pushClips(): void {
  getWindow()?.webContents.send(IPC.ClipsChanged, store.listAll(getSettings().historyCap))
}

function startAiJob(id: number, action: AiAction): void {
  const row = store.getItem(id)
  if (!row || row.type !== 'text' || !row.text_content) return
  enqueue(id, action, row.text_content)
}

export function registerIpc(): void {
  ipcMain.handle(IPC.ClipsList, () => store.listAll(getSettings().historyCap))

  ipcMain.handle(IPC.ClipsCopy, async (_e, id: number): Promise<CopyResult> => {
    const row = store.getItem(id)
    if (!row) return { ok: false, reason: 'gone' }
    if (row.type === 'text') {
      writeTextClip(id, row.text_content ?? '', row.html_content)
    } else if (row.type === 'image') {
      if (!row.image_path || !existsSync(row.image_path)) return { ok: false, reason: 'gone' }
      writeImageClip(id, row.image_path)
    } else {
      let paths: string[] = []
      try {
        paths = JSON.parse(row.file_paths ?? '[]') as string[]
      } catch {
        return { ok: false, reason: 'gone' }
      }
      if (paths.length === 0 || !paths.every((p) => existsSync(p))) {
        return { ok: false, reason: 'missing-file' }
      }
      await writeFilesClip(id, paths)
    }
    store.bumpToTop(id)
    pushClips()
    return { ok: true }
  })

  ipcMain.handle(IPC.ClipsPin, (_e, payload: { id: number; pinned: boolean }) => {
    store.setPinned(payload.id, payload.pinned)
    pushClips()
  })

  ipcMain.handle(IPC.ClipsDelete, (_e, id: number) => {
    blobs.gcBlobs(store.deleteItem(id))
    pushClips()
  })

  ipcMain.handle(IPC.ClipsClear, (_e, payload: { keepPinned: boolean }) => {
    blobs.gcBlobs(store.clearItems(payload.keepPinned))
    pushClips()
  })

  ipcMain.handle(IPC.UiSetExpanded, (_e, expanded: boolean) => setExpanded(expanded))

  ipcMain.handle(
    IPC.UiMetrics,
    (): UiMetrics => ({ menuBarHeight: menuBarHeight(), pillWidth: PILL_W })
  )

  ipcMain.handle(IPC.UiContextMenu, (_e, payload: { id: number }) => {
    const win = getWindow()
    if (!win) return
    popupClipMenu(win, payload.id, {
      onPin: (id, pinned) => {
        store.setPinned(id, pinned)
        pushClips()
      },
      onDelete: (id) => {
        blobs.gcBlobs(store.deleteItem(id))
        pushClips()
      },
      onClearUnpinned: () => {
        blobs.gcBlobs(store.clearItems(true))
        pushClips()
      },
      onAi: (id, action) => startAiJob(id, action)
    })
  })

  ipcMain.handle(IPC.AiAvailability, async () => {
    await resolveClaude()
    return aiAvailable()
  })

  ipcMain.handle(IPC.SettingsGet, (): Settings => getSettings())
  ipcMain.handle(IPC.SettingsSet, (_e, patch: Partial<Settings>): Settings => setSettings(patch))

  onJobEvent((ev) => {
    const win = getWindow()
    if (ev.status === 'done' && ev.result) {
      const text = ev.result
      const hash = createHash('sha1').update('text:').update(text).digest('hex')
      const preview = text.replace(/\s+/g, ' ').trim().slice(0, 200)
      const { id } = store.insertOrBump({
        type: 'text',
        hash,
        preview,
        textContent: text,
        byteSize: Buffer.byteLength(text)
      })
      writeTextClip(id, text)
      pushClips()
      const out: AiJobEvent = {
        jobId: ev.jobId,
        sourceClipId: ev.clipId,
        action: ev.action,
        status: 'done',
        newClipId: id
      }
      win?.webContents.send(IPC.AiJob, out)
    } else {
      const out: AiJobEvent = {
        jobId: ev.jobId,
        sourceClipId: ev.clipId,
        action: ev.action,
        status: ev.status,
        message: ev.message
      }
      win?.webContents.send(IPC.AiJob, out)
    }
  })
}
