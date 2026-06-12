import { app } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'fs'

// Permanent home for clipboard data — deliberately NOT app.getPath('userData').
// userData is derived from the package name, so an app rename or repackage would
// orphan the history. This path never changes across updates or reinstalls.
export const DATA_DIR = join(homedir(), 'Library', 'Application Support', 'IslandVault')
export const BLOBS_DIR = join(DATA_DIR, 'blobs')
export const DB_PATH = join(DATA_DIR, 'vault.db')

export function ensureStorageDirs(): void {
  mkdirSync(BLOBS_DIR, { recursive: true })
}

// One-time move from the legacy userData location (pre-permanent-storage builds).
export function migrateLegacyStore(): void {
  if (existsSync(DB_PATH)) return
  const legacyDb = join(app.getPath('userData'), 'vault.db')
  if (!existsSync(legacyDb)) return
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(legacyDb + suffix)) copyFileSync(legacyDb + suffix, DB_PATH + suffix)
  }
  const legacyBlobs = join(app.getPath('userData'), 'blobs')
  if (existsSync(legacyBlobs)) {
    cpSync(legacyBlobs, BLOBS_DIR, { recursive: true, force: false })
  }
}
