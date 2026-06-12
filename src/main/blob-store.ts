import { app } from 'electron'
import type { NativeImage } from 'electron'
import { mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

let dir = ''

export function initBlobStore(): void {
  dir = join(app.getPath('userData'), 'blobs')
  mkdirSync(dir, { recursive: true })
}

export function saveImage(
  hash: string,
  png: Buffer,
  img: NativeImage
): { imagePath: string; thumbPath: string } {
  const imagePath = join(dir, `${hash}.png`)
  writeFileSync(imagePath, png)
  const { width } = img.getSize()
  const thumb = width > 280 ? img.resize({ width: 280 }) : img
  const thumbPath = join(dir, `${hash}.thumb.jpg`)
  writeFileSync(thumbPath, thumb.toJPEG(80))
  return { imagePath, thumbPath }
}

export function gcBlobs(paths: string[]): void {
  for (const p of paths) {
    try {
      unlinkSync(p)
    } catch {
      // already gone
    }
  }
}
