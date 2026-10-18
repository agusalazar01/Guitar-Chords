import { useEffect, useMemo, useRef } from 'react'
import DiagramView from './Diagram.tsx'
import { diagramsFor } from '../lib/chordLibrary.ts'
import { formatTime } from '../lib/youtube.ts'
import type { Segment } from '../lib/types.ts'

interface Props {
  segments: Segment[]; activeIndex: number; time: number; hideNames: boolean; easyOnly: boolean
  alt: Record<string, number>; onAlt: (chord: string) => void; onSelect: (i: number) => void
}

/** Carrusel horizontal: el acorde actual al centro y destacado; anteriores y siguientes parcialmente visibles. */
export default function ChordStrip({ segments, activeIndex, time, hideNames, easyOnly, alt, onAlt, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const lists = useMemo(() => {
    const m = new Map<string, ReturnType<typeof diagramsFor>>()
    for (const s of segments) if (!m.has(s.chord) && s.chord !== 'N') m.set(s.chord, diagramsFor(s.chord, easyOnly))
    return m
  }, [segments, easyOnly])

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[data-current="true"]')
    const c = box.current
    if (el && c) c.scrollTo({ left: el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [activeIndex])

  return (
    <div ref={box} className="relative flex items-end gap-3 overflow-x-auto py-2" style={{ paddingInline: 'calc(50% - 80px)' }} aria-label="Secuencia de acordes">
      {segments.map((s, i) => {
        const current = i === activeIndex, past = !current && s.end <= time
        const ds = lists.get(s.chord) ?? []
        const d = ds.length ? ds[(alt[s.chord] ?? 0) % ds.length] : undefined
        const shown = hideNames ? '?' : s.chord === 'N' ? '—' : s.chord
        return (
          <div key={i} data-current={current} className={`w-[160px] shrink-0 rounded-2xl border-2 p-2 text-center transition-all ${current ? 'border-accent bg-panel' : 'border-transparent'} ${past ? 'scale-90 opacity-40' : current ? '' : 'scale-90 opacity-70'}`}>
            <button onClick={() => onSelect(i)} aria-current={current ? 'true' : undefined} className="block w-full"
              aria-label={`${hideNames ? 'Acorde' : s.chord} ${i + 1}, desde ${formatTime(s.start)}`}>
              <div className="flex min-h-[150px] items-center justify-center">
                {d ? <DiagramView d={d} /> : s.chord !== 'N' && <p className="px-2 text-xs text-mute">No hay una posición verificada para {s.chord}.</p>}
              </div>
              <span className={`block text-3xl font-extrabold leading-tight ${current ? 'text-accent' : ''}`}>{shown}</span>
              <span className="text-[11px] text-mute">{formatTime(s.start)}{s.confidence !== null && s.confidence < 0.6 ? ' ≈' : ''}</span>
            </button>
            {current && ds.length > 1 && <button className="mt-1 min-h-9 w-full rounded-lg border border-line text-xs" onClick={() => onAlt(s.chord)}>Otra posición ({((alt[s.chord] ?? 0) % ds.length) + 1}/{ds.length})</button>}
          </div>
        )
      })}
    </div>
  )
}
