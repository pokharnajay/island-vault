import { app } from 'electron'
import * as store from './store'
import type { Settings } from '@shared/types'

// Hard cap on retained clips — the vault keeps only the most recent MAX_HISTORY,
// evicting older unpinned items as new ones arrive. Not user-tunable (no UI), so
// it is clamped on every read regardless of any older stored value.
const MAX_HISTORY = 100

const DEFAULTS: Settings = {
  historyCap: MAX_HISTORY,
  launchAtLogin: false,
  translateTarget: 'English',
  aiModel: 'haiku' // fast + cheap for clipboard-sized transforms; clear to use the default model
}

export function getSettings(): Settings {
  const raw = store.getSetting('app')
  const base = (): Settings => {
    if (!raw) return { ...DEFAULTS }
    try {
      return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
    } catch {
      return { ...DEFAULTS }
    }
  }
  const s = base()
  s.historyCap = Math.min(s.historyCap, MAX_HISTORY)
  return s
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  store.setSetting('app', JSON.stringify(next))
  if (patch.launchAtLogin !== undefined && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
  }
  return next
}
