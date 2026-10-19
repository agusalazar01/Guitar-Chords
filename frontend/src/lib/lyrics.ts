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

const NOISE = /\b(official|oficial|video|videoclip|clip|audio|lyrics?|letra|hd|hq|4k|remaster(ed)?|en vivo|live|ft|feat|visualizer|music|musical|stereo|mono)\b/gi
/** Limpia un título de YouTube o un nombre de archivo para buscar la letra: quita extensión, paréntesis y palabras de relleno. */
export function cleanTitle(s: string): string {
  return s
    .replace(/\.(mp3|wav|m4a|ogg|flac)$/i, '')
    .replace(/\s(feat\.?|ft\.?|featuring)\s.*$/i, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
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

/** Punto de ajuste: la línea que en la letra empieza en `l` suena en el segundo `t` del audio o video. */
export interface LyricAnchor { l: number; t: number }

/** Tiempo de la letra que corresponde al tiempo t del audio: lineal entre puntos de ajuste (corrige intros más largas y versiones
 *  en vivo más lentas o rápidas); fuera de los puntos, avanza a la misma velocidad. Sin puntos, es t (más el corrimiento). */
export function lyricTime(t: number, anchors: LyricAnchor[] = [], offset = 0): number {
  const x = t - offset
  if (!anchors.length) return x
  const a = [...anchors].sort((p, q) => p.t - q.t)
  if (x <= a[0].t) return a[0].l + (x - a[0].t)
  for (let i = 1; i < a.length; i++) if (x <= a[i].t) { const p = a[i - 1], q = a[i]; return p.l + ((x - p.t) * (q.l - p.l)) / (q.t - p.t) }
  const z = a[a.length - 1]; return z.l + (x - z.t)
}
/** Inverso de lyricTime: en qué segundo del audio suena el momento l de la letra. */
export function audioTime(l: number, anchors: LyricAnchor[] = [], offset = 0): number {
  if (!anchors.length) return l + offset
  const a = [...anchors].sort((p, q) => p.l - q.l)
  if (l <= a[0].l) return a[0].t + (l - a[0].l) + offset
  for (let i = 1; i < a.length; i++) if (l <= a[i].l) { const p = a[i - 1], q = a[i]; return p.t + ((l - p.l) * (q.t - p.t)) / (q.l - p.l) + offset }
  const z = a[a.length - 1]; return z.t + (l - z.l) + offset
}
/** Agrega un punto de ajuste; descarta los que quedarían en contradicción (una línea posterior antes que una anterior). */
export function addAnchor(anchors: LyricAnchor[] = [], l: number, t: number): LyricAnchor[] {
  const keep = anchors.filter((a) => Math.abs(a.l - l) > 0.01 && (a.l < l ? a.t < t - 0.2 : a.t > t + 0.2))
  return [...keep, { l, t }].sort((p, q) => p.l - q.l)
}

/** Artista y canción a partir del título de un video («Julieta Venegas - Me Voy (Video Oficial)»). Sin « - », artist es null. */
export function parseVideoTitle(raw: string): { artist: string | null; title: string; query: string } {
  const base = raw.replace(/^\s*mix\s*[-–—:]\s*/i, '').replace(/[([{【].*?[)\]}】]/g, ' ')
  const parts = base.split(/\s+[-–—|]\s+/).map((x) => cleanTitle(x)).filter(Boolean)
  if (parts.length >= 2) { const a = mainArtist(parts[0]) || parts[0]; return { artist: a, title: parts[1], query: `${a} ${parts[1]}` } }
  const t = cleanTitle(base)
  return { artist: null, title: t, query: t }
}

const wordsOf = (s: string) => norm(s).split(' ').filter((w) => w.length > 1)
/** Elige sola una letra solo si es muy probable: el título coincide y además coincide el artista o la duración (±3 s).
 *  Con solo el título (p. ej. un archivo «Buenas Noches.mp3») no elige: hay muchas canciones con el mismo nombre. */
export function pickConfident(results: LyricResult[], want: { artist: string | null; title: string }, duration: number | null): LyricResult | null {
  const tw = new Set(wordsOf(want.title)), aw = new Set(wordsOf(want.artist ?? ''))
  if (!tw.size) return null
  const ok = results.filter((r) => {
    if (r.instrumental || !r.syncedLyrics) return false
    const rt = wordsOf(r.trackName)
    if (!rt.length) return false
    const titleOk = rt.filter((w) => tw.has(w)).length / rt.length >= 0.8 && [...tw].filter((w) => rt.includes(w)).length / tw.size >= 0.6
    if (!titleOk) return false
    const ra = wordsOf(r.artistName)
    const artistOk = aw.size > 0 && ra.filter((w) => aw.has(w)).length >= Math.min(2, Math.max(1, aw.size))
    const durOk = !!duration && !!r.duration && Math.abs(r.duration - duration) <= 3
    return artistOk || durOk
  })
  ok.sort((a, b) => Math.abs((a.duration ?? 0) - (duration ?? 0)) - Math.abs((b.duration ?? 0) - (duration ?? 0)))
  return ok[0] ?? null
}

/** Letra pegada a mano: con marcas [mm:ss] queda sincronizada; si no, solo texto. */
export function pastedLyrics(text: string, trackName: string): SongLyrics {
  const synced = parseLrc(text)
  return { source: 'manual', trackName, artistName: '', synced: synced.length >= 3 ? synced : null, plain: synced.length >= 3 ? null : text.trim() }
}

/** Artista principal: sin «(Feat. …)», «ft.», ni los demás artistas («A & B», «A, B», «A x B», «A y B»). */
export function mainArtist(a: string): string {
  return a
    .replace(/[([{【].*?[)\]}】]/g, ' ')
    .replace(/\s(feat\.?|ft\.?|featuring|con)\s.*$/i, ' ')
    .split(/\s*(?:&|,|\+|\/|\sx\s|\sy\s|\sand\s)\s*/i)[0]
    .replace(/\s+/g, ' ')
    .trim()
}

/** Texto para buscar el cifrado: «canción artista principal», sin agregados (feat., en vivo, paréntesis, años…). */
export function songbookText(track: string, artist: string | null): string {
  const t = cleanTitle(track.replace(/[([{【].*?[)\]}】]/g, ' '))
  const a = artist ? mainArtist(artist) : ''
  return `${t} ${a}`.replace(/\s+/g, ' ').trim()
}
