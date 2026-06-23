import { publicPath } from './publicPath'

declare global {
  interface Window {
    __GAOKAO_OFFLINE_DATA__?: Record<string, unknown>
  }
}

export function fetchPublic(path: string): Promise<Response> {
  const normalizedPath = path.replace(/^\/+/, '')
  const offlineData =
    typeof window !== 'undefined' && window.location.protocol === 'file:'
      ? window.__GAOKAO_OFFLINE_DATA__
      : undefined

  if (offlineData) {
    if (Object.prototype.hasOwnProperty.call(offlineData, normalizedPath)) {
      return Promise.resolve(
        new Response(JSON.stringify(offlineData[normalizedPath]), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        })
      )
    }
    return Promise.resolve(new Response('', { status: 404 }))
  }

  return fetch(publicPath(path))
}
