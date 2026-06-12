import { execFile } from 'child_process'

export interface FrontApp {
  name: string
  bundleId: string
  path: string
}

const SELF_BUNDLE = 'com.jaypokharna.islandvault'

// NSWorkspace.frontmostApplication is public API — no accessibility/automation TCC.
export function getFrontmostApp(): Promise<FrontApp | null> {
  // The completion value (last expression) is what osascript prints to stdout —
  // console.log in JXA goes to stderr.
  const jxa = `ObjC.import('AppKit');
const a = $.NSWorkspace.sharedWorkspace.frontmostApplication;
JSON.stringify({ name: a.localizedName.js, bundleId: a.bundleIdentifier.js, path: a.bundleURL.path.js });`
  return new Promise((resolve) => {
    execFile(
      '/usr/bin/osascript',
      ['-l', 'JavaScript', '-e', jxa],
      { timeout: 2000 },
      (err, stdout) => {
        if (err) return resolve(null)
        try {
          const o = JSON.parse(stdout.trim()) as FrontApp
          resolve(o.bundleId && o.bundleId !== SELF_BUNDLE ? o : null)
        } catch {
          resolve(null)
        }
      }
    )
  })
}
