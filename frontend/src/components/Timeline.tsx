import { useEffect, useRef } from 'react'
import { formatTime } from '../lib/youtube.ts'
import type { Segment } from '../lib/types.ts'

interface Props {
  segments: Segment[]; activeIndex: number; time: number; offset: number
  hideNames: boolean; onSelect: (i: number) => void
}

export default function Timeline({ segments, activeIndex, time, offset, hideNames, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const nextIndex = segments.findIndex((s, i) => i !== activeIndex && s.end + offset > time && (activeIndex < 0 || i > activeIndex))

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[data-current="true"]')
    const c = box.current
    if (el && c) c.scrollTo({ left: el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [activeIndex])

  return (
    <div ref={box} className="relative flex items-end gap-2 overflow-x-auto py-3 px-2 snap-x" aria-label="Secuencia de acordes">
      {segments.map((s, i) => {
        const current = i === activeIndex
        const past = !current && s.end + offset <= time
        const next = i === nextIndex
        const low = s.confidence !== null && s.confidence < 0.6
        return (
          <button key={i} data-current={current} onClick={() => onSelect(i)}
            aria-current={current ? 'true' : undefined}
            aria-label={`${hideNames ? 'Acorde' : s.chord} ${i + 1}, desde ${formatTime(s.start + offset)}`}
            className={`pick shrink-0 snap-center flex flex-col items-center justify-center transition-all
              ${current ? 'w-28 h-32 bg-accent text-accent-fg shadow-lg' : 'w-20 h-24 border-2'}
              ${next ? 'border-next text-fg' : 'border-line text-fg'} ${past ? 'opacity-45' : ''}`}>
            <span className={`font-extrabold leading-none ${current ? 'text-4xl' : 'text-2xl'}`}>{hideNames ? '?' : s.chord === 'N' ? '—' : s.chord}</span>
            <span className="text-[11px] mt-1 opacity-80">{formatTime(s.start + offset)}</span>
            {low && <span className="text-[10px]" title="Confianza baja">≈ dudoso</span>}
          </button>
        )
      })}
    </div>
  )
}
