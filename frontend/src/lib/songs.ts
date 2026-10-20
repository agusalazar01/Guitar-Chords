/** Almacenamiento local persistente (IndexedDB): canciones, acordes originales y corregidos, ajustes y el audio. */
import type { Segment } from './types.ts'
import type { LyricAnchor, SongLyrics } from './lyrics.ts'
import type { ChordEvent, CifradoLine } from './cifrado.ts'

export interface SongSettings { videoId: string | null; transpose: number; offset: number; capo?: number; advanced?: boolean; simplified?: boolean }
export interface Song {
  id: string; filename: string; createdAt: number; duration: number; method: string; lowConfidence: boolean
  original: Segment[]; corrections: Segment[] | null; settings: SongSettings; audio: Blob | null // null = acordes marcados a mano sobre un video (sin audio)
  kind?: 'analysis' | 'manual' | 'cifrado' // cifrado = acordes de un cancionero ubicados con la letra
  cifrado?: { events: ChordEvent[]; lines?: CifradoLine[]; capo?: number; key?: string } // acordes del cifrado en el tiempo de la letra (se recalculan al ajustar la letra)
  order?: number // posición en «Mi cancionero» (menor = más arriba)
  lyrics?: SongLyrics | null; lyricsOffset?: number // letra (LRCLIB o propia) y su corrimiento en segundos
  lyricsAnchors?: LyricAnchor[] // puntos «esta línea empieza acá» marcados por el usuario (ajustan intro y versiones más lentas o rápidas)
  beats?: number[]; bpm?: number | null; downbeat?: number; beatsPerBar?: number; key?: string | null; advanced?: Segment[] // análisis v0.3
}

const DB = 'guitar-chords', STORE = 'songs'
let dbp: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(new Error('No se pudo abrir el almacenamiento local.'))
  })
  return dbp
}
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = f(t.objectStore(STORE))
    t.oncomplete = () => resolve(req.result)
    t.onerror = t.onabort = () => reject(new Error('No se pudo guardar en el almacenamiento local (¿falta espacio?).'))
  })
}

export const saveSong = (s: Song) => tx('readwrite', (o) => o.put(s)).then(() => undefined)
export const getSong = (id: string) => tx<Song | undefined>('readonly', (o) => o.get(id))
export const deleteSong = (id: string) => tx('readwrite', (o) => o.delete(id)).then(() => undefined)
/** Orden del cancionero: el elegido por el usuario; las canciones sin posición (anteriores a v0.6) van por fecha, las nuevas arriba. */
export const sortSongs = (list: Song[]) => [...list].sort((a, b) => (a.order ?? -a.createdAt / 1e12) - (b.order ?? -b.createdAt / 1e12) || b.createdAt - a.createdAt)
export const listSongs = async (): Promise<Song[]> => sortSongs((await tx<Song[]>('readonly', (o) => o.getAll())) ?? [])
/** Posición para una canción nueva: arriba de todas. */
export const topOrder = (list: Song[]) => Math.min(0, ...list.map((s) => s.order ?? -s.createdAt / 1e12)) - 1
/** Guarda un nuevo orden (lista completa en el orden deseado). */
export async function saveOrder(list: Song[]): Promise<Song[]> {
  const out = list.map((s, i) => ({ ...s, order: i }))
  for (const s of out) await saveSong(s)
  return out
}
export const requestPersistence = () => navigator.storage?.persist?.().catch(() => false)
