import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '@shared/ipc-channels'

export const PANEL_W = 440
export const PANEL_H = 540
export const PILL_W = 196

let win: BrowserWindow | null = null
let expanded = false

function targetDisplay(): Electron.Display {
  return screen.getAllDisplays().find((d) => d.internal) ?? screen.getPrimaryDisplay()
}

export function menuBarHeight(): number {
  const d = targetDisplay()
  return Math.max(24, d.workArea.y - d.bounds.y)
}

function position(): void {
  if (!win || win.isDestroyed()) return
  const d = targetDisplay()
  const x = Math.round(d.bounds.x + (d.bounds.width - PANEL_W) / 2)
  win.setBounds({ x, y: d.bounds.y, width: PANEL_W, height: PANEL_H })
}

function onDisplaysChanged(): void {
  if (!win || win.isDestroyed()) return
  position()
  setExpanded(false)
  win.webContents.send(IPC.UiCollapse)
}

export function createOverlayWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: PANEL_W,
    height: PANEL_H,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    roundedCorners: false,
    alwaysOnTop: true,
    show: false,
    type: 'panel',
    hiddenInMissionControl: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver', 1)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  win.setIgnoreMouseEvents(true, { forward: true })
  position()

  win.once('ready-to-show', () => win?.showInactive())
  win.on('closed', () => {
    win = null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  screen.on('display-added', onDisplaysChanged)
  screen.on('display-removed', onDisplaysChanged)
  screen.on('display-metrics-changed', onDisplaysChanged)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

export function getWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

export function setExpanded(next: boolean): void {
  if (!win || win.isDestroyed() || expanded === next) return
  expanded = next
  if (next) {
    win.setIgnoreMouseEvents(false)
  } else {
    win.setIgnoreMouseEvents(true, { forward: true })
  }
}
