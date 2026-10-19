// Archivo de Mi Cancionero (.cancionero): una o varias canciones para compartir o como copia de seguridad.
// Formato: «MCBK1\n» + largo de la cabecera (10 dígitos) + «\n» + cabecera JSON (las canciones sin audio) + los audios uno tras otro.
// Así un archivo con audios grandes se lee por partes, sin cargar todo en memoria como texto.
import type { Song } from './songs.ts'

const MAGIC = 'MCBK1\n'
export const FILE_EXT = '.cancionero'
export const FILE_MIME = 'application/octet-stream'

interface Header { app: 'mi-cancionero'; format: 1; exportedAt: number; songs: (Omit<Song, 'audio'> & { audio: { size: number; type: string } | null })[] }

/** Arma el archivo; con withAudio = false los audios propios no se incluyen (para compartir). */
export function encodeSongs(songs: Song[], withAudio: boolean): Blob {
  const parts: Blob[] = []
  const header: Header = {
    app: 'mi-cancionero', format: 1, exportedAt: Date.now(),
    songs: songs.map((s) => {
      const a = withAudio && s.audio ? s.audio : null
      if (a) parts.push(a)
      return { ...s, audio: a ? { size: a.size, type: a.type || 'audio/mpeg' } : null }
    }),
  }
  const json = new TextEncoder().encode(JSON.stringify(header))
  return new Blob([MAGIC, String(json.length).padStart(10, '0'), '\n', json, ...parts], { type: FILE_MIME })
}

/** Lee un archivo de Mi Cancionero. Error claro si no lo es. */
export async function decodeSongs(file: Blob): Promise<Song[]> {
  const head = await file.slice(0, MAGIC.length + 11).text()
  if (!head.startsWith(MAGIC)) throw new Error('Ese archivo no es de Mi Cancionero.')
  const len = Number(head.slice(MAGIC.length, MAGIC.length + 10))
  const start = MAGIC.length + 11
  if (!Number.isFinite(len) || len <= 0 || start + len > file.size) throw new Error('El archivo está incompleto o dañado.')
  let h: Header
  try { h = JSON.parse(await file.slice(start, start + len).text()) as Header } catch { throw new Error('El archivo está dañado.') }
  if (h.app !== 'mi-cancionero' || !Array.isArray(h.songs)) throw new Error('Ese archivo no es de Mi Cancionero.')
  let pos = start + len
  return h.songs.map((s) => {
    let audio: Blob | null = null
    if (s.audio) { audio = file.slice(pos, pos + s.audio.size, s.audio.type); pos += s.audio.size }
    return { ...s, audio } as Song
  })
}

/** Canciones para guardar al importar. Compartida: siempre como nuevas. Copia de seguridad: se saltean las que ya están. */
export function songsToAdd(existing: Song[], incoming: Song[], mode: 'share' | 'restore', newId: () => string): Song[] {
  const have = new Set(existing.map((s) => s.id))
  const top = Math.min(0, ...existing.map((s) => s.order ?? 0))
  const list = mode === 'restore' ? incoming.filter((s) => !have.has(s.id)) : incoming.map((s) => ({ ...s, id: newId(), createdAt: Date.now() }))
  return list.map((s, i) => ({ ...s, order: top - list.length + i }))
}

export const safeName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'cancion'
