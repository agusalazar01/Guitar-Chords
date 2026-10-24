// Búsqueda de letras en LRCLIB (https://lrclib.net): gratis, sin clave ni cuenta. En la APK la consulta sale por la capa nativa de
// Capacitor (sin restricciones de CORS y con un User-Agent que identifica la app, como pide LRCLIB); en la web, con fetch.
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import type { LyricResult } from './lyrics.ts'

const BASE = 'https://lrclib.net/api'
const UA = 'MiCancionero/0.6 (https://github.com/agusalazar01/Guitar-Chords)'

async function getJson(url: string, who = 'LRCLIB'): Promise<unknown> {
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.get({ url, headers: { 'User-Agent': UA, Accept: 'application/json' }, connectTimeout: 15000, readTimeout: 15000 })
    if (r.status < 200 || r.status >= 300) throw new Error(`${who} respondió ${r.status}`)
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data
  }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok) throw new Error(`${who} respondió ${r.status}`)
    return await r.json()
  } finally { clearTimeout(timer) }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** LRCLIB a veces tarda o devuelve un error pasajero: hasta 3 intentos antes de dar el error. */
async function retry<T>(f: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await f() } catch (e) { if (i >= tries) throw e; await wait(800 * i) }
  }
}
/** Texto de búsqueda sin lo que suele estorbar: paréntesis, «letra», «video oficial», «feat.», signos. */
export function cleanQuery(q: string): string {
  return q.replace(/[([{].*?[)\]}]/g, ' ').replace(/\b(letra|lyrics?|video|oficial|official|audio|en vivo|live|remaster(ed)?|hd|hq)\b/gi, ' ')
    .replace(/\b(feat|ft)\.?\s.*$/i, ' ').replace(/[^\p{L}\p{N}' -]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Busca letras por texto libre (título, artista o ambos). Si no encuentra nada, prueba con el texto limpio y separando
 *  artista y título («Artista - Título»). Lanza un error con un mensaje claro si no hay conexión. */
export async function searchLyrics(q: string): Promise<LyricResult[]> {
  const ask = async (p: Record<string, string>) => {
    const data = await retry(() => getJson(`${BASE}/search?${new URLSearchParams(p)}`))
    return Array.isArray(data) ? (data as LyricResult[]) : []
  }
  try {
    let res = await ask({ q })
    const c = cleanQuery(q)
    if (!res.length && c && c !== q.trim()) res = await ask({ q: c })
    if (!res.length) {
      const parts = q.split(/\s+[-–—|]\s+/).map(cleanQuery).filter(Boolean)
      if (parts.length >= 2) res = await ask({ track_name: parts[1], artist_name: parts[0] })
      if (!res.length && parts.length >= 2) res = await ask({ track_name: parts[1] })
      if (!res.length && c) res = await ask({ track_name: c })
    }
    return res
  } catch (e) {
    const m = (e as Error).message
    throw new Error(m.startsWith('LRCLIB') ? `No se pudo buscar la letra (${m}). Probá de nuevo en un momento.` : 'No se pudo buscar la letra: revisá la conexión a Internet.')
  }
}

/** Segunda fuente (lyrics.ovh, gratis y sin clave): solo texto, sin tiempos. Se usa cuando LRCLIB no responde o no encuentra la
 *  letra, y se ofrece para elegir (nunca se elige sola). Necesita artista y título. null si no la tiene o no responde. */
export async function searchPlainLyrics(artist: string, title: string): Promise<LyricResult | null> {
  const a = artist.trim(), t = title.trim()
  if (a.length < 2 || t.length < 2) return null
  try {
    const data = await getJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`, 'lyrics.ovh') as { lyrics?: unknown }
    const text = typeof data?.lyrics === 'string' ? data.lyrics.replace(/\r\n?/g, '\n').replace(/^Paroles de la chanson.*\n/i, '').trim() : ''
    if (text.length < 40) return null
    return { id: -1, trackName: t, artistName: `${a} (lyrics.ovh, sin tiempos)`, albumName: null, duration: null, plainLyrics: text, syncedLyrics: null }
  } catch { return null }
}
