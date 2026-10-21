import { findActiveIndex } from '../lib/chords.ts'
import { beatPosition } from '../lib/engine/beats.ts'
import type { Segment } from '../lib/types.ts'

interface Props { segments: Segment[]; beats: number[]; downbeat: number; bpb: number; time: number; hideNames: boolean; marked?: boolean }

/** Rejilla de pulsos: un casillero por tiempo, el acorde escrito en el tiempo donde entra y el tiempo actual resaltado.
 *  Avanza de compás en compás. Con «Marcar pulso» usa los «uno» marcados; si no, es una estimación. */
export default function BeatGrid({ segments, beats, downbeat, bpb, time, hideNames, marked }: Props) {
  const pos = beats.length ? beatPosition(beats, time, downbeat, bpb) : null
  if (!pos) return null
  const nBars = bpb >= 6 ? 1 : 2 // 6/8 y 12/8: un compás, para que los casilleros no queden finitos
  const first = pos.index - pos.inBar, cells: { i: number; label: string; cont: boolean }[] = []
  for (let i = first; i < first + nBars * bpb && i < beats.length - 1; i++) {
    const k = i >= 0 ? findActiveIndex(segments, beats[i] + 0.03) : -1
    const starts = k >= 0 && segments[k].start >= beats[i] - 0.05
    const name = k >= 0 ? (hideNames ? '?' : segments[k].chord === 'N' ? '—' : segments[k].chord) : ''
    cells.push({ i, label: starts || i === first ? name : '', cont: !starts })
  }
  return (
    <div className="flex items-stretch gap-1 overflow-hidden" role="img"
      aria-label={`Compás ${pos.bar}, tiempo ${pos.inBar + 1} de ${bpb}${marked ? '' : ' (estimado)'}`}>
      {cells.map((c, n) => {
        const now = c.i === pos.index, one = n % bpb === 0
        return (
          <div key={c.i} className={`flex h-14 min-w-0 flex-1 items-center justify-center rounded-lg font-bold transition-colors
            ${one && n > 0 ? 'ml-3' : ''} ${one ? 'border-l-4 border-mute' : ''}
            ${now ? 'bg-accent text-accent-fg' : 'bg-panel'}`}>
            <span className={`truncate px-0.5 ${c.label.length > 3 ? 'text-base' : 'text-xl'} ${c.cont && !now ? 'opacity-50' : ''}`}>{c.label}</span>
          </div>
        )
      })}
    </div>
  )
}
