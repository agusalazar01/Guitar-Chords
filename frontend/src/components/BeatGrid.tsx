import { findActiveIndex } from '../lib/chords.ts'
import { beatPosition } from '../lib/engine/beats.ts'
import type { Segment } from '../lib/types.ts'
import { beatLabels } from '../lib/beatgrid.ts'

interface Props { segments: Segment[]; beats: number[]; downbeat: number; bpb: number; time: number; hideNames: boolean; marked?: boolean }

/** Rejilla de pulsos: un casillero por tiempo, cada acorde escrito (completo) en el tiempo donde entra y el tiempo actual
 *  resaltado. Avanza de compás en compás. Con «Marcar pulso» usa los «uno» marcados; si no, es una estimación. */
export default function BeatGrid({ segments, beats, downbeat, bpb, time, hideNames, marked }: Props) {
  const pos = beats.length ? beatPosition(beats, time, downbeat, bpb) : null
  if (!pos) return null
  const nBars = bpb >= 6 ? 1 : 2 // 6/8 y 12/8: un compás, para que los casilleros no queden finitos
  const first = pos.index - pos.inBar
  const labels = beatLabels(segments, beats, first, nBars * bpb)
  const name = (c: string) => (hideNames ? '?' : c === 'N' ? '—' : c)
  let cont = '' // el acorde que viene sonando de antes, al empezar el compás
  if (!labels[0].length) { const k = findActiveIndex(segments, beats[Math.max(0, first)] ?? time); if (k >= 0) cont = segments[k].chord }
  return (
    <div className="flex gap-2 overflow-hidden" role="img"
      aria-label={`Compás ${pos.bar}, tiempo ${pos.inBar + 1} de ${bpb}${marked ? '' : ' (estimado)'}`}>
      {Array.from({ length: nBars }, (_, bar) => {
        const cells = labels.slice(bar * bpb, (bar + 1) * bpb), base = first + bar * bpb
        return (
          <div key={base} className="grid min-w-0 flex-1 gap-0.5 border-l-4 border-mute pl-0.5" style={{ gridTemplateColumns: `repeat(${bpb}, minmax(0, 1fr))` }}>
            {cells.map((_, j) => (
              <div key={j} style={{ gridRow: 1, gridColumn: j + 1 }}
                className={`h-11 rounded-md transition-colors ${base + j === pos.index ? 'bg-accent' : 'bg-panel'}`} />
            ))}
            {cells.map((cs, j) => {
              const txt = cs.length ? cs.map(name).join(' ') : bar === 0 && j === 0 && cont ? name(cont) : ''
              if (!txt) return null
              let span = 1
              while (j + span < cells.length && !cells[j + span].length) span++
              return (
                <span key={`l${j}`} style={{ gridRow: 1, gridColumn: `${j + 1} / span ${span}` }}
                  className={`pointer-events-none z-10 self-center overflow-hidden whitespace-nowrap px-1 font-bold leading-none
                    ${txt.length <= 3 * span ? 'text-lg' : txt.length <= 4 * span ? 'text-sm' : 'text-xs'} ${base + j === pos.index ? 'text-accent-fg' : ''} ${cs.length ? '' : 'opacity-50'}`}>{txt}</span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
