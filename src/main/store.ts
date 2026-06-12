import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'fs'
import { basename } from 'path'
import { DB_PATH, ensureStorageDirs, migrateLegacyStore } from './storage-paths'
import type { ClipMeta, ClipType } from '@shared/types'

export interface ClipRowFull {
  id: number
  type: ClipType
  hash: string
  preview: string
  text_content: string | null
  html_content: string | null
  image_path: string | null
  thumb_path: string | null
  image_w: number | null
  image_h: number | null
  file_paths: string | null
  byte_size: number
  pinned: number
  created_at: number
  last_copied_at: number
  source_app: string | null
  source_app_name: string | null
}

export interface NewClip {
  type: ClipType
  hash: string
  preview: string
  textContent?: string
  htmlContent?: string
  imagePath?: string
  thumbPath?: string
  imageW?: number
  imageH?: number
  filePaths?: string[]
  byteSize: number
  sourceApp?: string
  sourceAppName?: string
}

let db: DatabaseSync

export function initStore(): void {
  ensureStorageDirs()
  migrateLegacyStore()
  db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('text','image','files')),
      hash TEXT NOT NULL UNIQUE,
      preview TEXT NOT NULL,
      text_content TEXT,
      html_content TEXT,
      image_path TEXT,
      thumb_path TEXT,
      image_w INTEGER,
      image_h INTEGER,
      file_paths TEXT,
      byte_size INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_copied_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_order ON items(pinned DESC, last_copied_at DESC);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  `)
  migrateSchema()
}

function migrateSchema(): void {
  const row = db.prepare('PRAGMA user_version').get() as unknown as { user_version: number }
  let v = row.user_version

  // v2: blob columns hold bare filenames (resolved against BLOBS_DIR at use time)
  // so the data directory can move without breaking rows. v<2 stored absolute paths.
  if (v < 2) {
    const images = db
      .prepare('SELECT id, image_path, thumb_path FROM items WHERE image_path IS NOT NULL')
      .all() as unknown as Pick<ClipRowFull, 'id' | 'image_path' | 'thumb_path'>[]
    const upd = db.prepare('UPDATE items SET image_path = ?, thumb_path = ? WHERE id = ?')
    db.exec('BEGIN')
    try {
      for (const r of images) {
        upd.run(
          r.image_path ? basename(r.image_path) : null,
          r.thumb_path ? basename(r.thumb_path) : null,
          r.id
        )
      }
      db.exec('PRAGMA user_version = 2')
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    v = 2
  }

  // v3: source-app attribution + per-app icon cache
  if (v < 3) {
    db.exec('BEGIN')
    try {
      try {
        db.exec('ALTER TABLE items ADD COLUMN source_app TEXT')
        db.exec('ALTER TABLE items ADD COLUMN source_app_name TEXT')
      } catch {
        // columns already present (fresh DBs migrated mid-version)
      }
      db.exec(
        'CREATE TABLE IF NOT EXISTS app_icons (bundle_id TEXT PRIMARY KEY, name TEXT, icon_file TEXT)'
      )
      db.exec('PRAGMA user_version = 3')
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}

export function insertOrBump(c: NewClip): { id: number; inserted: boolean } {
  const existing = db.prepare('SELECT id FROM items WHERE hash = ?').get(c.hash) as
    | unknown as { id: number }
    | undefined
  const now = Date.now()
  if (existing) {
    db.prepare('UPDATE items SET last_copied_at = ? WHERE id = ?').run(now, existing.id)
    return { id: existing.id, inserted: false }
  }
  const info = db
    .prepare(
      `INSERT INTO items
       (type, hash, preview, text_content, html_content, image_path, thumb_path,
        image_w, image_h, file_paths, byte_size, pinned, created_at, last_copied_at,
        source_app, source_app_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`
    )
    .run(
      c.type,
      c.hash,
      c.preview,
      c.textContent ?? null,
      c.htmlContent ?? null,
      c.imagePath ?? null,
      c.thumbPath ?? null,
      c.imageW ?? null,
      c.imageH ?? null,
      c.filePaths ? JSON.stringify(c.filePaths) : null,
      c.byteSize,
      now,
      now,
      c.sourceApp ?? null,
      c.sourceAppName ?? null
    )
  return { id: Number(info.lastInsertRowid), inserted: true }
}

export function bumpToTop(id: number): void {
  db.prepare('UPDATE items SET last_copied_at = ? WHERE id = ?').run(Date.now(), id)
}

export function setPinned(id: number, pinned: boolean): void {
  db.prepare('UPDATE items SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id)
}

export function getItem(id: number): ClipRowFull | undefined {
  return db.prepare('SELECT * FROM items WHERE id = ?').get(id) as unknown as
    | ClipRowFull
    | undefined
}

function blobPaths(rows: Pick<ClipRowFull, 'image_path' | 'thumb_path'>[]): string[] {
  const out: string[] = []
  for (const r of rows) {
    if (r.image_path) out.push(r.image_path)
    if (r.thumb_path) out.push(r.thumb_path)
  }
  return out
}

export function deleteItem(id: number): string[] {
  const row = getItem(id)
  if (!row) return []
  db.prepare('DELETE FROM items WHERE id = ?').run(id)
  return blobPaths([row])
}

export function clearItems(keepPinned: boolean): string[] {
  const where = keepPinned ? 'WHERE pinned = 0' : ''
  const rows = db
    .prepare(`SELECT image_path, thumb_path FROM items ${where}`)
    .all() as unknown as ClipRowFull[]
  db.prepare(`DELETE FROM items ${where}`).run()
  return blobPaths(rows)
}

export function evict(cap: number): string[] {
  const doomed = db
    .prepare(
      'SELECT id, image_path, thumb_path FROM items WHERE pinned = 0 ORDER BY last_copied_at DESC LIMIT -1 OFFSET ?'
    )
    .all(cap) as unknown as ClipRowFull[]
  if (doomed.length === 0) return []
  const del = db.prepare('DELETE FROM items WHERE id = ?')
  db.exec('BEGIN')
  try {
    for (const r of doomed) del.run(r.id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return blobPaths(doomed)
}

export function listAll(cap: number): ClipMeta[] {
  const rows = db
    .prepare('SELECT * FROM items ORDER BY pinned DESC, last_copied_at DESC LIMIT ?')
    .all(cap) as unknown as ClipRowFull[]
  return rows.map(toMeta)
}

// Full-text search across content, preview, file paths, and source app name.
export function search(q: string, cap: number): ClipMeta[] {
  const rows = db
    .prepare(
      `SELECT * FROM items
       WHERE lower(
         coalesce(text_content,'') || ' ' || preview || ' ' ||
         coalesce(file_paths,'') || ' ' || coalesce(source_app_name,'')
       ) LIKE '%' || lower(?) || '%'
       ORDER BY pinned DESC, last_copied_at DESC LIMIT ?`
    )
    .all(q, cap) as unknown as ClipRowFull[]
  return rows.map(toMeta)
}

export function getAppIcon(bundleId: string): { name: string; icon_file: string } | undefined {
  return db.prepare('SELECT name, icon_file FROM app_icons WHERE bundle_id = ?').get(
    bundleId
  ) as unknown as { name: string; icon_file: string } | undefined
}

export function upsertAppIcon(bundleId: string, name: string, iconFile: string): void {
  db.prepare(
    `INSERT INTO app_icons (bundle_id, name, icon_file) VALUES (?, ?, ?)
     ON CONFLICT(bundle_id) DO UPDATE SET name = excluded.name, icon_file = excluded.icon_file`
  ).run(bundleId, name, iconFile)
}

function toMeta(r: ClipRowFull): ClipMeta {
  const meta: ClipMeta = {
    id: r.id,
    type: r.type,
    preview: r.preview,
    pinned: !!r.pinned,
    createdAt: r.created_at,
    lastCopiedAt: r.last_copied_at,
    byteSize: r.byte_size
  }
  if (r.type === 'image') {
    meta.thumbUrl = `vault://thumb/${r.id}`
    if (r.image_w && r.image_h) meta.imageSize = { w: r.image_w, h: r.image_h }
  }
  if (r.type === 'files' && r.file_paths) {
    try {
      const paths = JSON.parse(r.file_paths) as string[]
      meta.files = paths.map((p) => ({ path: p, name: basename(p), exists: existsSync(p) }))
    } catch {
      meta.files = []
    }
  }
  if (r.source_app && r.source_app_name) {
    meta.sourceApp = {
      bundleId: r.source_app,
      name: r.source_app_name,
      iconUrl: `vault://appicon/${encodeURIComponent(r.source_app)}`
    }
  }
  return meta
}

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as unknown as
    | { value: string }
    | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}
