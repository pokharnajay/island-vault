import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { getAppIcon, getItem } from './store'
import { resolveBlob } from './blob-store'

export function registerVaultScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'vault',
      privileges: { standard: false, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

// vault://thumb/<id>, vault://image/<id>, vault://appicon/<bundleId>
export function registerVaultProtocol(): void {
  protocol.handle('vault', (req) => {
    try {
      const u = new URL(req.url)
      const key = decodeURIComponent(u.pathname.replace(/^\//, ''))
      let blob: string | null | undefined
      if (u.host === 'appicon') {
        blob = getAppIcon(key)?.icon_file
      } else {
        const id = Number(key)
        const row = Number.isFinite(id) ? getItem(id) : undefined
        blob = u.host === 'image' ? row?.image_path : row?.thumb_path
      }
      if (!blob) return new Response('not found', { status: 404 })
      return net.fetch(pathToFileURL(resolveBlob(blob)).toString())
    } catch {
      return new Response('bad request', { status: 400 })
    }
  })
}
