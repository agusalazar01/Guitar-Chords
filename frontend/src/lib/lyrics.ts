// Letras de canciones: formato LRC (líneas con tiempo), limpieza de títulos y elección automática de la versión.
// Sin dependencias: se usa en la app y en las pruebas de Node.

export interface LyricLine { t: number; text: string }
export interface SongLyrics {
  source: 'lrclib' | 'manual'; id?: number
  trackName: string; artistName: string; albumName?: string; duration?: number
  synced: LyricLine[] | null // null = solo texto, sin tiempos
  plain: string | null
}
/** Resultado de búsqueda de LRCLIB (campos que usa la app). */
export interface LyricResult {
  id: number; trackName: string; artistName: string; albumName: string | null; duration: number | null
  instrumental?: boolean; plainLyrics: string | null; syncedLyrics: string | null
}

/** Convierte texto LRC («[01:23.45] verso») en líneas ordenadas. Admite varias marcas por línea y descarta etiquetas [ar:], [ti:]… */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)]
    if (!tags.length) continue
    const text = raw.replace(/\[[^\]]*\]/g, '').trim()
    for (const m of tags) out.push({ t: Number(m[1]) * 60 + Number(m[2].replace(':', '.')), text })
  }
  out.sort((a, b) => a.t - b.t)
  return out
}

export function toSongLyrics(r: LyricResult): SongLyrics {
  const synced = r.syncedLyrics ? parseLrc(r.syncedLyrics) : null
  return {
    source: 'lrclib', id: r.id, trackName: r.trackName, artistName: r.artistName, albumName: r.albumName ?? undefined,
    duration: r.duration ?? undefined, synced: synced && synced.length ? synced : null, plain: r.plainLyrics,
  }
}

/** Índice de la línea que suena en el tiempo t (o −1 antes de la primera). */
export function activeLine(lines: LyricLine[], t: number): number {
  let lo = 0, hi = lines.length - 1, ans = -1
  while (lo <= hi) { const m = (lo + hi) >> 1; if (lines[m].t <= t) { ans = m; lo = m + 1 } else hi = m - 1 }
  return ans
}

const NOISE = /\b(official|oficial|video|videoclip|clip|audio|lyrics?|letra|hd|hq|4k|remaster(ed)?|en vivo|live|ft|feat|visualizer|music|musical)\b/gi
/** Limpia un título de YouTube o un nombre de archivo para buscar la letra: quita extensión, paréntesis y palabras de relleno. */
export function cleanTitle(s: string): string {
  return s
    .replace(/\.(mp3|wav|m4a|ogg|flac)$/i, '')
    .replace(/[([{【].*?[)\]}】]/g, ' ')
    .replace(/_/g, ' ')
    .replace(NOISE, ' ')
    .replace(/[|•·"“”]/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Puntaje 0–1 de cuánto coincide un resultado con lo buscado (palabras del título y del artista presentes). */
export function matchScore(r: Pick<LyricResult, 'trackName' | 'artistName'>, query: string): number {
  const q = new Set(norm(query).split(' ').filter((w) => w.length > 1))
  const words = norm(`${r.trackName} ${r.artistName}`).split(' ').filter((w) => w.length > 1)
  const title = norm(r.trackName).split(' ').filter((w) => w.length > 1)
  if (!q.size || !title.length) return 0
  const titleHit = title.filter((w) => q.has(w)).length / title.length
  const queryHit = [...q].filter((w) => words.includes(w)).length / q.size
  return 0.6 * titleHit + 0.4 * queryHit
}

/** Elige sola una versión solo si es muy probable: título que coincide, con tiempos y duración a ±3 s del audio o video. */
export function pickAuto(results: LyricResult[], query: string, duration: number | null): LyricResult | null {
  const ok = results
    .filter((r) => !r.instrumental && r.syncedLyrics && matchScore(r, query) >= 0.8)
    .filter((r) => duration && r.duration ? Math.abs(r.duration - duration) <= 3 : false)
    .sort((a, b) => Math.abs((a.duration ?? 0) - (duration ?? 0)) - Math.abs((b.duration ?? 0) - (duration ?? 0)))
  return ok[0] ?? null
}

/** Ordena resultados para mostrar: primero los que coinciden y tienen tiempos; sin duplicados exactos. */
export function rankResults(results: LyricResult[], query: string, duration: number | null): LyricResult[] {
  const seen = new Set<string>()
  return results
    .filter((r) => !r.instrumental && (r.syncedLyrics || r.plainLyrics))
    .map((r) => ({ r, s: matchScore(r, query) + (r.syncedLyrics ? 0.2 : 0) - (duration && r.duration ? Math.min(0.3, Math.abs(r.duration - duration) / 60) : 0) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r)
    .filter((r) => { const k = `${norm(r.trackName)}|${norm(r.artistName)}|${Math.round(r.duration ?? 0)}|${!!r.syncedLyrics}`; if (seen.has(k)) return false; seen.add(k); return true })
}
