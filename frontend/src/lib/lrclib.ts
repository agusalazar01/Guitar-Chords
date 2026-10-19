// Búsqueda de letras en LRCLIB (https://lrclib.net): gratis, sin clave ni cuenta. En la APK la consulta sale por la capa nativa de
// Capacitor (sin restricciones de CORS y con un User-Agent que identifica la app, como pide LRCLIB); en la web, con fetch.
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import type { LyricResult } from './lyrics.ts'

const BASE = 'https://lrclib.net/api'
const UA = 'MiCancionero/0.6 (https://github.com/agusalazar01/Guitar-Chords)'

async function getJson(url: string): Promise<unknown> {
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.get({ url, headers: { 'User-Agent': UA, Accept: 'application/json' }, connectTimeout: 15000, readTimeout: 15000 })
    if (r.status < 200 || r.status >= 300) throw new Error(`LRCLIB respondió ${r.status}`)
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data
  }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok) throw new Error(`LRCLIB respondió ${r.status}`)
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
