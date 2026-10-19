import { useEffect, useRef, useState } from 'react'
import { activeLine, addAnchor, audioTime, lyricTime } from '../lib/lyrics.ts'
import type { LyricAnchor, SongLyrics } from '../lib/lyrics.ts'

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`

/** Letra debajo del compás. Mientras no empieza el canto (intro, partes habladas) no se resalta ninguna línea; con «Empezó a cantar»
 *  y «La próxima línea empieza ahora» se marcan puntos de ajuste: la letra se corre hasta donde está el canto en tu versión y se
 *  estira o acorta entre puntos (versiones en vivo más lentas o rápidas). */
export default function LyricsView({ lyrics, time, offset, anchors, onAdjust, onSeek, onRemove }: {
  lyrics: SongLyrics; time: number; offset: number; anchors: LyricAnchor[]
  onAdjust: (a: { offset?: number; anchors?: LyricAnchor[] }) => void; onSeek: (t: number) => void; onRemove: () => void
}) {
  const [full, setFull] = useState(false)
  const lines = lyrics.synced
  const lt = lyricTime(time, anchors, offset)
  const idx = lines ? activeLine(lines, lt) : -1
  const first = lines?.find((l) => l.text) ?? null
  const activeRef = useRef<HTMLLIElement>(null)
  useEffect(() => { if (full) activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [idx, full])
  const small = 'min-h-9 rounded-lg border border-line px-2 text-xs'
  const cur = lines && idx >= 0 ? lines[idx].text : '', next = lines ? lines.slice(idx + 1).find((l) => l.text)?.text ?? '' : ''
  const nextLine = lines ? lines.slice(idx + 1).find((l) => l.text) : undefined
  const round = (x: number) => Math.round(x * 100) / 100
  const intro = !!first && lt < first.t
  const adjusted = anchors.length > 0 || offset !== 0
  return (
    <section className="rounded-2xl border border-line bg-panel p-3" aria-label="Letra">
      {lines ? (
        intro ? (
          <div>
            <p className="text-sm text-mute">♪ Intro · la letra empieza en {mmss(audioTime(first.t, anchors, offset))}{adjusted ? ' (ajustada)' : ''}</p>
            <p className="min-h-5 text-sm text-mute">{first.text}</p>
            <button className="mt-1 min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg" onClick={() => onAdjust({ anchors: addAnchor(anchors, first.t, time - offset) })}>Empezó a cantar</button>
          </div>
        ) : (
          <div aria-live="off">
            <p className="min-h-7 text-lg font-bold leading-snug">{cur || <span className="text-mute">♪</span>}</p>
            <p className="min-h-5 text-sm text-mute">{next}</p>
          </div>
        )
      ) : <p className="text-sm text-mute">Esta letra no tiene tiempos: se muestra completa.</p>}
      {(full || !lines) && (
        <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto border-t border-line pt-2 text-sm">
          {lines ? lines.map((l, i) => (
            <li key={i} ref={i === idx ? activeRef : undefined}>
              <button className={`w-full rounded px-1 text-left ${i === idx ? 'bg-accent/20 font-semibold' : ''}`} onClick={() => onSeek(audioTime(l.t, anchors, offset))}>{l.text || '♪'}</button>
            </li>
          )) : (lyrics.plain ?? '').split('\n').map((l, i) => <li key={i}>{l || ' '}</li>)}
        </ol>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute">
        <span className="min-w-0 flex-1 truncate">{lyrics.trackName} · {lyrics.artistName}{lyrics.source === 'lrclib' ? ' · letra de LRCLIB' : ''}</span>
        {lines && <>
          <button className={small} onClick={() => setFull((f) => !f)}>{full ? 'Ocultar letra' : 'Ver toda'}</button>
          <button className={small} onClick={() => onAdjust({ offset: round(offset - 0.25) })} aria-label="Letra antes">−¼ s</button>
          <span>{offset >= 0 ? '+' : ''}{offset.toFixed(2)} s</span>
          <button className={small} onClick={() => onAdjust({ offset: round(offset + 0.25) })} aria-label="Letra después">+¼ s</button>
          {!intro && nextLine && <button className={small} onClick={() => onAdjust({ anchors: addAnchor(anchors, nextLine.t, time - offset) })}>La próxima línea empieza ahora</button>}
          {adjusted && <button className={small} onClick={() => onAdjust({ offset: 0, anchors: [] })}>Quitar ajustes</button>}
        </>}
        <button className={small} onClick={onRemove}>Quitar letra</button>
      </div>
    </section>
  )
}
