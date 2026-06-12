import { execFile } from 'child_process'

function execFileP(cmd: string, args: string[], timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout }, (err) => (err ? reject(err) : resolve()))
  })
}

export interface FrontApp {
  name: string
  bundleId: string
  path: string
}

const SELF_BUNDLE = 'com.jaypokharna.islandvault'

// NSWorkspace.frontmostApplication is public API — no accessibility/automation TCC.
// app.getFileIcon returns a generic placeholder for .app bundles — go straight
// to NSWorkspace.iconForFile and downscale with sips.
export async function extractAppIcon(appPath: string, destPng: string): Promise<boolean> {
  const jxa = `ObjC.import('AppKit');
const icon = $.NSWorkspace.sharedWorkspace.iconForFile(${JSON.stringify(appPath)});
const rep = $.NSBitmapImageRep.imageRepWithData(icon.TIFFRepresentation);
const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
png.writeToFileAtomically(${JSON.stringify(destPng)}, true);
'ok';`
  try {
    await execFileP('/usr/bin/osascript', ['-l', 'JavaScript', '-e', jxa], 4000)
    await execFileP('/usr/bin/sips', ['-z', '64', '64', destPng], 4000)
    return true
  } catch {
    return false
  }
}

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
