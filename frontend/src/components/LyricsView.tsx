import { useEffect, useRef, useState } from 'react'
import { activeLine, addAnchor, audioTime, lyricTime } from '../lib/lyrics.ts'
import type { LyricAnchor, SongLyrics } from '../lib/lyrics.ts'

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`

/** Letra debajo del compás. Mientras no empieza el canto (intro, partes habladas) no se resalta ninguna línea; con «Empezó a cantar»
 *  y «La próxima línea empieza ahora» se marcan puntos de ajuste: la letra se corre hasta donde está el canto en tu versión y se
 *  estira o acorta entre puntos (versiones en vivo más lentas o rápidas). */
export default function LyricsView({ lyrics, time, offset, anchors, onAdjust, onSeek, onRemove, onChange, followsChords = false }: {
  lyrics: SongLyrics; time: number; offset: number; anchors: LyricAnchor[]; followsChords?: boolean
  onAdjust: (a: { offset?: number; anchors?: LyricAnchor[] }) => void; onSeek: (t: number) => void; onRemove: () => void
  onChange: () => void // «No es esta letra»: abre la búsqueda de letras
}) {
  const [full, setFull] = useState(false)
  const [tools, setTools] = useState(false) // ajustes de la letra, ocultos para que se vea la letra
  const [tapSync, setTapSync] = useState(false) // «Sincronizar tocando»: tocar en la lista la línea que se está cantando
  const lines = lyrics.synced
  const lt = lyricTime(time, anchors, offset)
  const idx = lines ? activeLine(lines, lt) : -1
  const first = lines?.find((l) => l.text) ?? null
  const activeRef = useRef<HTMLLIElement>(null)
  useEffect(() => { if (full) activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [idx, full])
  const small = 'btn min-h-9 px-2 text-xs'
  const cur = lines && idx >= 0 ? lines[idx].text : ''
  const upcoming = lines ? lines.slice(idx + 1).filter((l) => l.text).slice(0, 2).map((l) => l.text) : []
  const nextLine = lines ? lines.slice(idx + 1).find((l) => l.text) : undefined
  const round = (x: number) => Math.round(x * 100) / 100
  const intro = !!first && lt < first.t
  const adjusted = anchors.length > 0 || offset !== 0
  // La letra arrancó antes que el canto: mientras corren las primeras líneas (y todavía no se marcó el comienzo) se ofrece
  // «Empezó a cantar» también acá; al tocarlo, la primera línea pasa a empezar en ese momento y todo lo demás se corre igual.
  const firstIdx = lines && first ? lines.indexOf(first) : -1
  const early = !intro && firstIdx >= 0 && idx >= firstIdx && lines!.slice(firstIdx, idx + 1).filter((l) => l.text).length <= 3
    && !anchors.some((a) => Math.abs(a.l - first!.t) < 0.01)
  return (
    <section className="py-1" aria-label="Letra">
      {lines ? (
        intro ? (
          <div>
            <p className="text-base text-mute">♪ Intro · la letra empieza en {mmss(audioTime(first.t, anchors, offset))}{adjusted ? ' (ajustada)' : ''}</p>
            <p className="mt-1 text-lg text-mute">{first.text}</p>
            <button className="mt-1 min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg" onClick={() => onAdjust({ anchors: addAnchor(anchors, first.t, time - offset) })}>Empezó a cantar</button>
          </div>
        ) : (
          <div aria-live="off">
            <p key={idx} className="anim-rise min-h-9 text-2xl font-bold leading-snug">{cur || <span className="text-mute">♪</span>}</p>
            {upcoming.map((t, i) => <p key={i} className={`leading-snug text-mute ${i === 0 ? 'text-lg' : 'text-base opacity-70'}`}>{t}</p>)}
            {early && first && !followsChords && <div className="mt-1 flex flex-wrap items-center gap-2">
              <button className="min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg" onClick={() => onAdjust({ anchors: addAnchor(anchors, first.t, time - offset) })}>Empezó a cantar</button>
              <span className="text-xs text-mute">¿La letra se adelantó? Tocá cuando empiece a cantar «{first.text.slice(0, 28)}{first.text.length > 28 ? '…' : ''}»</span>
            </div>}
          </div>
        )
      ) : <p className="text-sm text-mute">Esta letra no tiene tiempos: se muestra completa.</p>}
      {lines && full && <button className="btn mt-2 min-h-9 w-full text-xs" onClick={() => { setFull(false); setTapSync(false) }}>Cerrar la letra completa</button>}
      {(full || !lines) && (
        <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl bg-panel p-2 text-sm">
          {lines ? lines.map((l, i) => (
            <li key={i} ref={i === idx ? activeRef : undefined}>
              <button className={`w-full rounded px-1 text-left ${i === idx ? 'bg-accent/20 font-semibold' : ''} ${tapSync && l.text ? 'border-l-2 border-accent pl-2' : ''}`}
                onClick={() => (tapSync && l.text ? onAdjust({ anchors: addAnchor(anchors, l.t, time - offset) }) : onSeek(audioTime(l.t, anchors, offset)))}>{l.text || '♪'}</button>
            </li>
          )) : (lyrics.plain ?? '').split('\n').map((l, i) => <li key={i}>{l || ' '}</li>)}
        </ol>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute">
        <span className="min-w-0 flex-1 truncate">{lyrics.trackName}{lyrics.artistName ? ` · ${lyrics.artistName}` : ''}{lyrics.source === 'lrclib' ? ' · LRCLIB' : ''}</span>
        <button className="min-h-9 px-1 text-xs underline" onClick={onChange}>No es esta letra</button>
        <button className={small} onClick={() => setTools((x) => !x)} aria-expanded={tools} aria-label="Ajustar la letra">{tools ? 'Listo' : '⚙ Ajustar letra'}</button>
      </div>
      {tools && followsChords && <div className="mt-2 space-y-2 text-xs text-mute">
        <p>Esta letra viene de la página de acordes y sigue a los acordes: para correrla, ajustá los acordes («Acordes» → «Marcar los
          cambios a mano»). Si encontrás la letra con tiempos, usá «No es esta letra».</p>
        <button className={small} onClick={() => setFull((f) => !f)}>{full ? 'Ocultar letra' : 'Ver toda'}</button>
      </div>}
      {tools && !followsChords && <div className="mt-2 space-y-2 text-xs text-mute">
        {lines && <>
          <p><b>«La letra empieza ahora»</b>: tocalo cuando se empieza a cantar la primera línea y toda la letra se corre a ese momento.
            Para afinar después: <b>«Esta línea empieza ahora»</b> justo cuando se canta la línea grande, o <b>«Sincronizar tocando»</b> y
            tocá en la lista cada línea cuando se canta. La letra y los acordes se corren juntos.</p>
          <div className="flex flex-wrap items-center gap-2">
            {first && <button className="btn-primary min-h-10 px-3 text-sm" onClick={() => onAdjust({ offset: 0, anchors: [{ l: first.t, t: time }] })}>La letra empieza ahora</button>}
            {!intro && cur && <button className={small} onClick={() => onAdjust({ anchors: addAnchor(anchors, lines[idx].t, time - offset) })}>Esta línea empieza ahora</button>}
            {!intro && nextLine && <button className={small} onClick={() => onAdjust({ anchors: addAnchor(anchors, nextLine.t, time - offset) })}>La próxima empieza ahora</button>}
            <button className={`${small} ${tapSync ? 'bg-accent text-accent-fg' : ''}`} aria-pressed={tapSync} onClick={() => { setTapSync((x) => !x); setFull(true) }}>{tapSync ? 'Terminar de sincronizar' : 'Sincronizar tocando'}</button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1">Correr todo:</span>
            {[-5, -1, 1, 5].map((d) => <button key={d} className={small} onClick={() => onAdjust({ offset: round(offset + d) })} aria-label={d < 0 ? `Letra ${-d} s antes` : `Letra ${d} s después`}>{d > 0 ? '+' : '−'}{Math.abs(d)} s</button>)}
            <span className="ml-1 font-semibold text-fg">{offset >= 0 ? '+' : '−'}{Math.abs(offset).toFixed(offset % 1 ? 2 : 0)} s</span>
            <span>(− antes · + después)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={small} onClick={() => setFull((f) => !f)}>{full ? 'Ocultar letra' : 'Ver toda'}</button>
            {adjusted && <button className={small} onClick={() => onAdjust({ offset: 0, anchors: [] })}>Quitar ajustes</button>}
            <button className={small} onClick={onRemove}>Quitar letra</button>
          </div>
        </>}
        {!lines && <button className={small} onClick={onRemove}>Quitar letra</button>}
      </div>}
    </section>
  )
}
