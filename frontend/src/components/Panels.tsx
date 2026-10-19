import { useEffect, useState } from 'react'
import { searchVideos } from '../lib/youtubeSearch.ts'
import { parseYouTubeId } from '../lib/youtube.ts'
import type { Song } from '../lib/songs.ts'
import type { VideoResult } from '../lib/types.ts'
import { Capacitor } from '@capacitor/core'
import { searchLyrics } from '../lib/lrclib.ts'
import { rankResults } from '../lib/lyrics.ts'
import type { LyricResult } from '../lib/lyrics.ts'

const isNative = () => { try { return Capacitor.isNativePlatform() } catch { return false } }
const fmtDur = (d: number | null) => (d ? `${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')}` : '')

/** Buscador único: por nombre busca la canción y su letra (LRCLIB, sin clave) y videos de YouTube (en la app con clave propia;
 *  sin clave, abre YouTube con la búsqueda hecha y el video vuelve con «Compartir → Mi Cancionero» en la APK, o pegando el enlace). */
export function SearchPanel({ onPick, onLyrics, onVideoSearch, recent, apiKey, lyricsQuery }: {
  onPick: (v: { id: string; title?: string }) => void; onLyrics: (r: LyricResult) => void
  onVideoSearch?: (q: string) => void // APK: abre la búsqueda de YouTube dentro de la app
  lyricsQuery?: string // si viene, busca solo la letra con este texto al abrirse
  recent: { id: string; title: string }[]; apiKey: string
}) {
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState('')
  const [results, setResults] = useState<VideoResult[] | null>(null)
  const [songs, setSongs] = useState<LyricResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lyrErr, setLyrErr] = useState<string | null>(null)

  async function videos(text: string) {
    if (!apiKey) return
    try {
      const r = await searchVideos(text, apiKey)
      setResults(r)
      if (!r.length) setErr('No hay videos reproducibles para esa búsqueda.')
    } catch (ex) { setErr((ex as Error).message); setResults(null) }
  }
  async function run(text: string) {
    setErr(null); setLyrErr(null); setAsked(text); setBusy(true); setSongs(null); setResults(null)
    await Promise.all([
      searchLyrics(text).then((r) => setSongs(rankResults(r, text, null).slice(0, 8)), (e: Error) => { setLyrErr(e.message); setSongs([]) }),
      videos(text),
    ])
    setBusy(false)
  }
  useEffect(() => { if (lyricsQuery) { setQ(lyricsQuery); void run(lyricsQuery) } }, [lyricsQuery]) // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const id = parseYouTubeId(q)
    if (id) { onPick({ id }); setResults(null); setSongs(null); return }
    if (/^https?:\/\//i.test(q.trim())) { setErr('Ese enlace no parece ser un video de YouTube válido.'); return }
    if (q.trim().length < 2) return
    if (onVideoSearch && isNative() && !apiKey) { onVideoSearch(q.trim()); return } // flujo rápido: video → letra → acordes
    await run(q.trim())
  }
  const ytUrl = (text: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`

  return (
    <div className="w-full">
      <form onSubmit={submit} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Canción, artista o enlace de YouTube"
          aria-label="Buscar canción" className="flex-1 min-h-11 rounded-lg border border-line bg-panel px-3" />
        <button className="min-h-11 px-4 rounded-lg bg-accent text-accent-fg font-semibold" disabled={busy}>{busy ? 'Buscando…' : 'Buscar'}</button>
      </form>
      {onVideoSearch && isNative() && !apiKey && (
        <p className="mt-1 text-xs text-mute">Buscar abre YouTube acá adentro: tocá el video y la app trae la letra y te ofrece los acordes.{' '}
          <button className="underline" onClick={() => q.trim().length > 1 && run(q.trim())}>Buscar solo la letra</button></p>)}
      {err && <p role="alert" className="mt-2 text-sm text-red-500">{err}</p>}
      {songs && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold">Canciones y letras</h3>
          {lyrErr && <p className="text-sm text-red-500">{lyrErr}</p>}
          {!lyrErr && !songs.length && <p className="text-sm text-mute">No encontré la letra de «{asked}». Probá con el título y el artista, sin otras palabras.</p>}
          <ul className="mt-1 space-y-1">
            {songs.map((r) => (
              <li key={r.id}>
                <button className="w-full rounded-lg border border-line bg-panel p-2 text-left" onClick={() => { onLyrics(r); setSongs(null); setQ(`${r.artistName} ${r.trackName}`); setAsked(`${r.artistName} ${r.trackName}`); void videos(`${r.artistName} ${r.trackName}`) }}>
                  <span className="block text-sm font-semibold">{r.trackName}</span>
                  <span className="block text-xs text-mute">{r.artistName}{r.albumName ? ` · ${r.albumName}` : ''}{r.duration ? ` · ${fmtDur(r.duration)}` : ''} · {r.syncedLyrics ? 'letra con tiempos' : 'letra sin tiempos'}</span>
                </button>
              </li>
            ))}
          </ul>
          {songs.length > 0 && <p className="mt-1 text-xs text-mute">Elegí una versión: la letra se guarda en tu cancionero. Si hay varias, conviene la que dura lo mismo que el video.</p>}
        </div>
      )}
      {asked && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold">Videos</h3>
          {results && results.length > 0 ? (
            <ul className="mt-1 grid gap-2 sm:grid-cols-2">
              {results.map((v) => (
                <li key={v.id} className="flex gap-3 rounded-lg border border-line bg-panel p-2">
                  <img src={v.thumbnail} alt="" className="w-28 h-16 object-cover rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm line-clamp-2">{v.title}</p>
                    <p className="text-xs text-mute truncate">{v.channel}{v.duration ? ` · ${v.duration}` : ''}</p>
                    <button onClick={() => { onPick({ id: v.id, title: v.title }); setResults(null); setAsked('') }} className="mt-1 text-sm underline min-h-8">Abrir en el reproductor</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 space-y-1 text-sm">
              <a href={ytUrl(asked)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 font-semibold">Buscar «{asked}» en YouTube ↗</a>
              <p className="text-xs text-mute">{isNative()
                ? 'Se abre YouTube. En el video que quieras, tocá Compartir → Mi Cancionero y vuelve acá solo.'
                : 'Se abre YouTube en otra pestaña: copiá el enlace del video y pegalo en el buscador.'}{!apiKey && ' Con tu clave de YouTube (Ajustes) los videos aparecen directamente acá.'}</p>
            </div>
          )}
        </div>
      )}
      {!songs && !asked && recent.length > 0 && (
        <p className="mt-2 text-xs text-mute">Recientes: {recent.map((r) => (
          <button key={r.id} onClick={() => onPick(r)} className="underline mr-2">{r.title}</button>))}</p>
      )}
    </div>
  )
}

export interface Job { filename: string; stage: 'decoding' | 'analyzing'; progress: number }

export function AudioPanel({ job, error, onFile, onCancel }: { job: Job | null; error: string | null; onFile: (f: File) => void; onCancel: () => void }) {
  return (
    <div className="space-y-2 text-sm">
      <p>Elegí un MP3 o WAV de tu teléfono (máx. 40 MB, hasta 15 min). Se analiza y se guarda <b>solo en este dispositivo</b>: no se sube a ningún servidor.</p>
      <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav" disabled={!!job} aria-label="Archivo de audio"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      {job && (
        <div role="status">
          <progress value={job.stage === 'analyzing' ? job.progress : undefined} max={1} className="w-full" aria-label="Progreso del análisis" />
          <p className="text-mute">{job.stage === 'decoding' ? 'Decodificando el audio…' : `Analizando acordes… ${Math.round(job.progress * 100)}%`}</p>
          {job.stage === 'analyzing' && <button className="min-h-10 px-3 rounded-lg border border-line" onClick={onCancel}>Cancelar análisis</button>}
        </div>
      )}
      {error && <p role="alert" className="text-red-500">{error}</p>}
    </div>
  )
}

export function HistoryPanel({ items, onOpen, onDelete }: { items: Song[]; onOpen: (s: Song) => void; onDelete: (s: Song) => void }) {
  if (!items.length) return <p className="text-sm text-mute">Todavía no hay canciones guardadas. Los análisis completados aparecen acá y se conservan en este teléfono.</p>
  return (
    <ul className="space-y-2 text-sm">
      {items.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-2">
          <button className="text-left underline min-h-10 truncate" onClick={() => onOpen(s)}>{s.filename}{!s.audio && <span className="text-mute no-underline"> · marcada sobre video</span>}</button>
          <button className="text-mute min-h-10 px-2" aria-label={`Borrar ${s.filename}`} onClick={() => onDelete(s)}>Borrar</button>
        </li>
      ))}
    </ul>
  )
}

const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
/** Acordes de la tonalidad (tríadas diatónicas + dominante con séptima). */
export function keyChords(key: string): string[] {
  const minor = key.endsWith('m'), r = NN.indexOf(minor ? key.slice(0, -1) : key)
  if (r < 0) return []
  const n = (i: number) => NN[(r + i) % 12]
  return minor
    ? [`${n(0)}m`, n(3), `${n(5)}m`, `${n(7)}m`, n(7), `${n(7)}7`, n(8), n(10)]
    : [n(0), `${n(2)}m`, `${n(4)}m`, n(5), n(7), `${n(7)}7`, `${n(9)}m`, `${n(2)}7`]
}

/** Marcar acordes sobre un video de YouTube: el usuario toca el acorde en el momento en que empieza (sin analizar audio). */
export function MarkPanel({ time, used, onMark, onUndo, canUndo, keyName, onKey }: {
  time: number; used: string[]; onMark: (chord: string) => void; onUndo: () => void; canUndo: boolean; keyName: string; onKey: (k: string) => void
}) {
  const [other, setOther] = useState('')
  const palette = [...new Set([...keyChords(keyName), ...used.filter((c) => c !== 'N')])]
  const btn = 'min-h-12 rounded-lg border border-line bg-bg px-2 text-base font-bold'
  return (
    <div className="space-y-2 text-sm">
      <p className="text-mute">Reproducí el video y tocá cada acorde <b>justo cuando empieza</b> ({time.toFixed(1)} s). Podés pausar, retroceder y volver a tocar para corregir. Se guarda en este teléfono junto al video; no se analiza ni se descarga el audio de YouTube.</p>
      <label className="flex items-center gap-2">Tonalidad
        <select value={keyName} onChange={(e) => onKey(e.target.value)} className="min-h-10 rounded-lg border border-line bg-panel px-2">
          {NN.flatMap((k) => [k, `${k}m`]).map((k) => <option key={k} value={k}>{k.endsWith('m') ? `${k.slice(0, -1)} menor` : `${k} mayor`}</option>)}
        </select></label>
      <div className="grid grid-cols-4 gap-2">
        {palette.map((c) => <button key={c} className={btn} onClick={() => onMark(c)}>{c}</button>)}
        <button className={btn} onClick={() => onMark('N')} title="Sin acorde">N</button>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (other.trim()) { onMark(other.trim()); setOther('') } }}>
        <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Otro acorde (ej. Bm7, F#, Dsus4)" className="min-h-10 flex-1 rounded-lg border border-line bg-panel px-3" />
        <button className="min-h-10 rounded-lg border border-line px-3">Marcar</button>
      </form>
      <button className="min-h-10 rounded-lg border border-line px-3" onClick={onUndo} disabled={!canUndo}>Deshacer última marca</button>
    </div>
  )
}
