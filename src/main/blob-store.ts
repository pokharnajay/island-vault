import type { NativeImage } from 'electron'
import { mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { isAbsolute, join } from 'path'
import { BLOBS_DIR } from './storage-paths'

export function initBlobStore(): void {
  mkdirSync(BLOBS_DIR, { recursive: true })
}

// Returns bare filenames — the store keeps blobs location-independent.
export function saveImage(
  hash: string,
  png: Buffer,
  img: NativeImage
): { imagePath: string; thumbPath: string } {
  const imageFile = `${hash}.png`
  writeFileSync(join(BLOBS_DIR, imageFile), png)
  const { width } = img.getSize()
  const thumb = width > 280 ? img.resize({ width: 280 }) : img
  const thumbFile = `${hash}.thumb.jpg`
  writeFileSync(join(BLOBS_DIR, thumbFile), thumb.toJPEG(80))
  return { imagePath: imageFile, thumbPath: thumbFile }
}

export function saveAppIcon(bundleId: string, png: Buffer): string {
  const file = `appicon-${bundleId.replace(/[^a-zA-Z0-9.-]/g, '_')}.png`
  writeFileSync(join(BLOBS_DIR, file), png)
  return file
}

export function resolveBlob(name: string): string {
  return isAbsolute(name) ? name : join(BLOBS_DIR, name)
}

export function gcBlobs(names: string[]): void {
  for (const n of names) {
    try {
      unlinkSync(resolveBlob(n))
    } catch {
      // already gone
    }
  }
}
