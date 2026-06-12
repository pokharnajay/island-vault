import { clipboard, nativeImage } from 'electron'
import { writeFilesToClipboard } from './pasteboard-files'

// Suppression: after a self-write, the watcher's next change is ours — bump the
// source clip instead of capturing a duplicate. Window-based: the user cannot
// realistically Cmd+C elsewhere within the window of clicking our own UI.
interface Suppression {
  clipId: number
  expiresAt: number
}

const WINDOW_MS = 1500
let slot: Suppression | null = null

function arm(clipId: number): void {
  slot = { clipId, expiresAt: Date.now() + WINDOW_MS }
}

export function consumeSuppression(): number | null {
  if (!slot) return null
  const { clipId, expiresAt } = slot
  slot = null
  return Date.now() < expiresAt ? clipId : null
}

export function writeTextClip(clipId: number, text: string, html?: string | null): void {
  arm(clipId)
  if (html) clipboard.write({ text, html })
  else clipboard.writeText(text)
}

export function writeImageClip(clipId: number, imagePath: string): void {
  arm(clipId)
  clipboard.writeImage(nativeImage.createFromPath(imagePath))
}

export async function writeFilesClip(clipId: number, paths: string[]): Promise<void> {
  arm(clipId)
  await writeFilesToClipboard(paths)
}
