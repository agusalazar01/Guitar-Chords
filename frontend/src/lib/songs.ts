/** Almacenamiento local persistente (IndexedDB): canciones, acordes originales y corregidos, ajustes y el audio. */
import type { Segment } from './types.ts'

export interface SongSettings { videoId: string | null; transpose: number; offset: number; capo?: number; advanced?: boolean }
export interface Song {
  id: string; filename: string; createdAt: number; duration: number; method: string; lowConfidence: boolean
  original: Segment[]; corrections: Segment[] | null; settings: SongSettings; audio: Blob
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
export const listSongs = async (): Promise<Song[]> => ((await tx<Song[]>('readonly', (o) => o.getAll())) ?? []).sort((a, b) => b.createdAt - a.createdAt)
export const requestPersistence = () => navigator.storage?.persist?.().catch(() => false)
