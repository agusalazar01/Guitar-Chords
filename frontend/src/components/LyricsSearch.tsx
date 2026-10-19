import { useEffect, useState } from 'react'
import { searchLyrics } from '../lib/lrclib.ts'
import { rankResults } from '../lib/lyrics.ts'
import type { LyricResult } from '../lib/lyrics.ts'

const dur = (d: number | null) => (d ? `${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')}` : '')

/** Búsqueda SOLO de letras (LRCLIB) con su propio campo; «Pegar letra» para cargarla a mano. Siempre arranca limpia. */
export default function LyricsSearch({ initial, onPick, onPaste, onClose }: {
  initial: string; onPick: (r: LyricResult) => void; onPaste: (text: string) => void; onClose: () => void
}) {
  const [q, setQ] = useState(initial)
  const [res, setRes] = useState<LyricResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [paste, setPaste] = useState(false)
  const [text, setText] = useState('')
  async function run(text: string) {
    const t = text.trim()
    if (t.length < 2) return
    setBusy(true); setErr(null); setRes(null)
    try { setRes(rankResults(await searchLyrics(t), t, null).slice(0, 10)) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  useEffect(() => { if (initial) void run(initial) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const small = 'btn'
  return (
    <section className="card space-y-2" aria-label="Buscar letra">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Letra</h2><button className={small} onClick={onClose}>Cerrar</button></div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(q) }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Canción y artista" aria-label="Buscar letra"
          className="field min-w-0 flex-1" />
        <button className="btn-primary" disabled={busy}>{busy ? 'Buscando…' : 'Buscar letra'}</button>
      </form>
      {err && <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-500">{err} <button className={small} onClick={() => run(q)}>Reintentar</button></p>}
      {res && !res.length && <p className="text-sm text-mute">No encontré esa letra. Probá con menos palabras (solo el nombre de la canción) o pegala a mano.</p>}
      {res && res.length > 0 && (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {res.map((r) => (
            <li key={r.id}><button className="w-full rounded-xl bg-panel2 p-2 text-left" onClick={() => onPick(r)}>
              <span className="block text-sm font-semibold">{r.trackName}</span>
              <span className="block text-xs text-mute">{r.artistName}{r.albumName ? ` · ${r.albumName}` : ''}{r.duration ? ` · ${dur(r.duration)}` : ''} · {r.syncedLyrics ? 'con tiempos' : 'sin tiempos'}</span>
            </button></li>
          ))}
        </ul>)}
      <button className={small} onClick={() => setPaste((x) => !x)}>{paste ? 'Cerrar pegar' : 'Pegar letra'}</button>
      {paste && <div className="space-y-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-label="Letra pegada"
          placeholder="Pegá la letra (si tiene marcas [01:23.45] queda sincronizada)" className="field w-full py-2 text-sm" />
        <button className={small} disabled={!text.trim()} onClick={() => onPaste(text)}>Usar esta letra</button>
      </div>}
    </section>
  )
}
