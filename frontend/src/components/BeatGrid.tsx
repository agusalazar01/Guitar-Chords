import { findActiveIndex } from '../lib/chords.ts'
import { beatPosition } from '../lib/engine/beats.ts'
import type { Segment } from '../lib/types.ts'

interface Props { segments: Segment[]; beats: number[]; downbeat: number; bpb: number; time: number; hideNames: boolean }

/** Rejilla de pulsos (dos compases): el pulso actual se oscurece y se ve en qué pulso cambia el acorde. Es una estimación. */
export default function BeatGrid({ segments, beats, downbeat, bpb, time, hideNames }: Props) {
  const pos = beats.length ? beatPosition(beats, time, downbeat, bpb) : null
  if (!pos) return null
  const first = pos.index - pos.inBar, cells: { i: number; label: string }[] = []
  for (let i = first; i < first + 2 * bpb && i < beats.length - 1; i++) {
    const k = i >= 0 ? findActiveIndex(segments, beats[i] + 0.03) : -1
    const starts = k >= 0 && segments[k].start >= beats[i] - 0.05
    const label = k >= 0 && (starts || i === first) ? (hideNames ? '?' : segments[k].chord === 'N' ? '—' : segments[k].chord) : ''
    cells.push({ i, label: label && !starts ? `· ${label}` : label })
  }
  return (
    <div className="flex items-stretch gap-1 overflow-hidden" role="img" aria-label={`Compás ${pos.bar}, tiempo ${pos.inBar + 1} de ${bpb} (estimado)`}>
      {cells.map((c, n) => (
        <div key={c.i} className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-md text-sm font-bold ${(n % bpb === 0 && n > 0) ? 'ml-2' : ''} ${c.i === pos.index ? 'bg-fg text-bg' : 'bg-panel border border-line'}`}>
          <span className="truncate px-0.5">{c.label}</span>
        </div>
      ))}
    </div>
  )
}
