import { app, Menu } from 'electron'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import * as store from './store'
import { aiAvailable } from './ai-runner'
import { getSettings } from './settings'
import type { AiAction } from '@shared/types'

export interface MenuHandlers {
  onPin: (id: number, pinned: boolean) => void
  onDelete: (id: number) => void
  onClearUnpinned: () => void
  onAi: (id: number, action: AiAction) => void
}

export function popupClipMenu(win: BrowserWindow, clipId: number, h: MenuHandlers): void {
  const row = store.getItem(clipId)
  if (!row) return

  const ai = aiAvailable()
  const template: MenuItemConstructorOptions[] = [
    {
      label: row.pinned ? 'Unpin' : 'Pin',
      click: () => h.onPin(clipId, !row.pinned)
    }
  ]

  if (row.type === 'text') {
    const aiSub: MenuItemConstructorOptions[] = [
      { label: 'Clean Up', click: () => h.onAi(clipId, 'cleanup') },
      { label: 'Summarize', click: () => h.onAi(clipId, 'summarize') },
      {
        label: `Translate to ${getSettings().translateTarget}`,
        click: () => h.onAi(clipId, 'translate')
      },
      { label: 'Extract Links & Emails', click: () => h.onAi(clipId, 'extract') }
    ]
    template.push({
      label: 'AI Actions',
      enabled: ai.ok,
      toolTip: ai.ok ? undefined : 'claude CLI not found',
      submenu: aiSub
    })
  }

  template.push(
    { type: 'separator' },
    { label: 'Delete', click: () => h.onDelete(clipId) },
    { type: 'separator' },
    { label: 'Clear Unpinned', click: () => h.onClearUnpinned() },
    { type: 'separator' },
    { label: 'Quit Island Vault', click: () => app.quit() }
  )

  Menu.buildFromTemplate(template).popup({ window: win })
}
