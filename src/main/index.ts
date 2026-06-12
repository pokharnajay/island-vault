import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IPC } from '@shared/ipc-channels'
import { createOverlayWindow, getWindow } from './overlay-window'
import { registerIpc } from './ipc'
import { initStore, listAll } from './store'
import { initBlobStore } from './blob-store'
import { registerVaultProtocol, registerVaultScheme } from './protocol'
import { startWatcher } from './clipboard-watcher'
import { resolveClaude } from './ai-runner'
import { getSettings } from './settings'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  registerVaultScheme()

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.jaypokharna.islandvault')
    if (process.platform === 'darwin') app.dock?.hide()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    initStore()
    initBlobStore()
    registerVaultProtocol()
    registerIpc()

    // Keep the OS login-item registration in sync with the stored setting
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: getSettings().launchAtLogin })
    }

    createOverlayWindow()

    startWatcher(() => {
      getWindow()?.webContents.send(IPC.ClipsChanged, listAll(getSettings().historyCap))
    })
    void resolveClaude()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createOverlayWindow()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
