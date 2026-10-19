import { useEffect, useRef, useState } from 'react'
import { activeLine } from '../lib/lyrics.ts'
import type { SongLyrics } from '../lib/lyrics.ts'

/** Letra debajo del compás: la línea que suena resaltada y la siguiente. «Ver toda» muestra la letra completa (tocar una línea salta ahí). */
export default function LyricsView({ lyrics, time, offset, onOffset, onSeek, onRemove }: {
  lyrics: SongLyrics; time: number; offset: number; onOffset: (o: number) => void; onSeek: (t: number) => void; onRemove: () => void
}) {
  const [full, setFull] = useState(false)
  const lines = lyrics.synced
  const idx = lines ? activeLine(lines, time - offset) : -1
  const activeRef = useRef<HTMLLIElement>(null)
  useEffect(() => { if (full) activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [idx, full])
  const small = 'min-h-9 rounded-lg border border-line px-2 text-xs'
  const cur = lines && idx >= 0 ? lines[idx].text : '', next = lines ? lines.slice(idx + 1).find((l) => l.text)?.text ?? '' : ''
  const round = (x: number) => Math.round(x * 100) / 100
  return (
    <section className="rounded-2xl border border-line bg-panel p-3" aria-label="Letra">
      {lines ? (
        <div aria-live="off">
          <p className="min-h-7 text-lg font-bold leading-snug">{cur || <span className="text-mute">♪</span>}</p>
          <p className="min-h-5 text-sm text-mute">{next}</p>
        </div>
      ) : <p className="text-sm text-mute">Esta letra no tiene tiempos: se muestra completa.</p>}
      {(full || !lines) && (
        <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto border-t border-line pt-2 text-sm">
          {lines ? lines.map((l, i) => (
            <li key={i} ref={i === idx ? activeRef : undefined}>
              <button className={`w-full rounded px-1 text-left ${i === idx ? 'bg-accent/20 font-semibold' : ''}`} onClick={() => onSeek(l.t + offset)}>{l.text || '♪'}</button>
            </li>
          )) : (lyrics.plain ?? '').split('\n').map((l, i) => <li key={i}>{l || ' '}</li>)}
        </ol>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute">
        <span className="min-w-0 flex-1 truncate">{lyrics.trackName} · {lyrics.artistName}{lyrics.source === 'lrclib' ? ' · letra de LRCLIB' : ''}</span>
        {lines && <>
          <button className={small} onClick={() => setFull((f) => !f)}>{full ? 'Ocultar letra' : 'Ver toda'}</button>
          <button className={small} onClick={() => onOffset(round(offset - 0.25))} aria-label="Letra antes">−¼ s</button>
          <span>{offset >= 0 ? '+' : ''}{offset.toFixed(2)} s</span>
          <button className={small} onClick={() => onOffset(round(offset + 0.25))} aria-label="Letra después">+¼ s</button>
          {idx + 1 < lines.length && <button className={small} onClick={() => onOffset(round(time - lines[Math.max(0, idx + 1)].t))}>La próxima línea empieza ahora</button>}
        </>}
        <button className={small} onClick={onRemove}>Quitar letra</button>
      </div>
    </section>
  )
}
