import { clipboard } from 'electron'
import { execFile } from 'child_process'
import { parse as parsePlist } from 'plist'

function safeRead(format: string): string {
  try {
    return clipboard.read(format)
  } catch {
    return ''
  }
}

export function hasFileClip(): boolean {
  try {
    return clipboard.has('NSFilenamesPboardType') || clipboard.has('public.file-url')
  } catch {
    return false
  }
}

export function rawFileFingerprint(): string {
  return safeRead('NSFilenamesPboardType') || safeRead('public.file-url')
}

export function readFilePaths(): string[] {
  const xml = safeRead('NSFilenamesPboardType')
  if (xml) {
    try {
      const parsed = parsePlist(xml)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {
      // fall through to single-url path
    }
  }
  const url = safeRead('public.file-url')
  if (url) {
    try {
      return [decodeURIComponent(new URL(url.trim()).pathname)]
    } catch {
      return []
    }
  }
  return []
}

export function writeFilesToClipboard(paths: string[]): Promise<void> {
  // NSMutableArray + addObject — a plain JS array of NSURL proxies marshals
  // incorrectly through arrayWithArray and NSPasteboard rejects it.
  const jxa = `ObjC.import('AppKit');
const pb = $.NSPasteboard.generalPasteboard;
pb.clearContents;
const arr = $.NSMutableArray.alloc.init;
${JSON.stringify(paths)}.forEach(p => arr.addObject($.NSURL.fileURLWithPath(p)));
if (!pb.writeObjects(arr)) throw new Error('writeObjects failed');`
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/osascript', ['-l', 'JavaScript', '-e', jxa], (err) =>
      err ? reject(err) : resolve()
    )
  })
}
