import { useState } from 'react'
import { searchVideos } from '../lib/youtubeSearch.ts'
import { parseYouTubeId } from '../lib/youtube.ts'
import type { Song } from '../lib/songs.ts'
import type { VideoResult } from '../lib/types.ts'

export function SearchPanel({ onPick, recent, apiKey }: { onPick: (v: { id: string; title?: string }) => void; recent: { id: string; title: string }[]; apiKey: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<VideoResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const id = parseYouTubeId(q)
    if (id) { onPick({ id }); setResults(null); return }
    if (/^https?:\/\//i.test(q.trim())) { setErr('Ese enlace no parece ser un video de YouTube válido.'); return }
    if (q.trim().length < 2) return
    setBusy(true)
    try {
      const r = await searchVideos(q.trim(), apiKey)
      setResults(r)
      if (!r.length) setErr('No hay resultados reproducibles. Probá con otro nombre.')
    } catch (ex) { setErr((ex as Error).message); setResults(null) } finally { setBusy(false) }
  }

  return (
    <div className="w-full">
      <form onSubmit={submit} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Canción, artista o enlace de YouTube"
          aria-label="Buscar canción" className="flex-1 min-h-11 rounded-lg border border-line bg-panel px-3" />
        <button className="min-h-11 px-4 rounded-lg bg-accent text-accent-fg font-semibold" disabled={busy}>{busy ? 'Buscando…' : 'Buscar'}</button>
      </form>
      {err && <p role="alert" className="mt-2 text-sm text-red-500">{err}</p>}
      {results && results.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {results.map((v) => (
            <li key={v.id} className="flex gap-3 rounded-lg border border-line bg-panel p-2">
              <img src={v.thumbnail} alt="" className="w-28 h-16 object-cover rounded" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm line-clamp-2">{v.title}</p>
                <p className="text-xs text-mute truncate">{v.channel}{v.duration ? ` · ${v.duration}` : ''}</p>
                <button onClick={() => { onPick({ id: v.id, title: v.title }); setResults(null) }} className="mt-1 text-sm underline min-h-8">Abrir en el reproductor</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!results && recent.length > 0 && (
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
          <button className="text-left underline min-h-10 truncate" onClick={() => onOpen(s)}>{s.filename}</button>
          <button className="text-mute min-h-10 px-2" aria-label={`Borrar ${s.filename}`} onClick={() => onDelete(s)}>Borrar</button>
        </li>
      ))}
    </ul>
  )
}
