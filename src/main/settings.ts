import { app } from 'electron'
import * as store from './store'
import type { Settings } from '@shared/types'

const DEFAULTS: Settings = {
  historyCap: 500,
  launchAtLogin: false,
  translateTarget: 'English',
  aiModel: 'haiku' // fast + cheap for clipboard-sized transforms; clear to use the default model
}

export function getSettings(): Settings {
  const raw = store.getSetting('app')
  if (!raw) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  store.setSetting('app', JSON.stringify(next))
  if (patch.launchAtLogin !== undefined && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
  }
  return next
}
