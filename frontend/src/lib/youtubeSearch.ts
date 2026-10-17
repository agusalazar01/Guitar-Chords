/** Búsqueda con YouTube Data API v3 usando la clave PROPIA del usuario (se guarda solo en el teléfono).
 *  Requiere Internet y envía la consulta y la clave a Google. */
import type { VideoResult } from './types.ts'

export function parseDuration(iso: string): string | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '')
  if (!m || !(m[1] || m[2] || m[3])) return null
  const h = Number(m[1] ?? 0), mi = Number(m[2] ?? 0), s = Number(m[3] ?? 0)
  return h ? `${h}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${mi}:${String(s).padStart(2, '0')}`
}

interface ApiError { error?: { errors?: { reason?: string }[] } }
async function check(r: Response): Promise<void> {
  if (r.ok) return
  let reason = ''
  try { reason = ((await r.json()) as ApiError).error?.errors?.[0]?.reason ?? '' } catch { /* sin cuerpo */ }
  if (['quotaExceeded', 'rateLimitExceeded', 'dailyLimitExceeded'].includes(reason))
    throw new Error('Se agotó la cuota diaria de la API de YouTube. Probá mañana o pegá un enlace directo.')
  if ([400, 401, 403].includes(r.status)) throw new Error('YouTube rechazó la clave de API. Revisala en Ajustes y comprobá que la Data API v3 esté habilitada.')
  throw new Error(`Error de YouTube (${r.status}).`)
}

export async function searchVideos(q: string, apiKey: string): Promise<VideoResult[]> {
  if (!apiKey) throw new Error('Para buscar necesitás tu propia clave de YouTube Data API (Ajustes). Mientras tanto, pegá un enlace.')
  const base = 'https://www.googleapis.com/youtube/v3'
  try {
    const r1 = await fetch(`${base}/search?${new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '10', videoEmbeddable: 'true', q, key: apiKey })}`)
    await check(r1)
    const items = ((await r1.json()) as { items?: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails?: Record<string, { url: string }> } }[] }).items ?? []
    if (!items.length) return []
    const r2 = await fetch(`${base}/videos?${new URLSearchParams({ part: 'contentDetails,status', id: items.map((i) => i.id.videoId).join(','), key: apiKey })}`)
    await check(r2)
    const info = new Map(((await r2.json()) as { items?: { id: string; contentDetails: { duration?: string }; status: { embeddable?: boolean } }[] }).items?.map((v) => [v.id, v]) ?? [])
    return items.filter((i) => info.get(i.id.videoId)?.status.embeddable).map((i) => ({
      id: i.id.videoId, title: i.snippet.title, channel: i.snippet.channelTitle,
      thumbnail: (i.snippet.thumbnails?.medium ?? i.snippet.thumbnails?.default)?.url ?? '',
      duration: parseDuration(info.get(i.id.videoId)?.contentDetails.duration ?? ''),
    }))
  } catch (e) {
    if (e instanceof TypeError) throw new Error('No hay conexión con YouTube. Revisá tu Internet.')
    throw e
  }
}
