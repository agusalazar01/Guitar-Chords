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

/** Busca letras por texto libre (título, artista o ambos). Lanza un error con un mensaje claro si no hay conexión. */
export async function searchLyrics(q: string): Promise<LyricResult[]> {
  try {
    const data = await getJson(`${BASE}/search?${new URLSearchParams({ q })}`)
    return Array.isArray(data) ? (data as LyricResult[]) : []
  } catch (e) {
    const m = (e as Error).message
    throw new Error(m.startsWith('LRCLIB') ? `No se pudo buscar la letra (${m}).` : 'No se pudo buscar la letra: revisá la conexión a Internet.')
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
