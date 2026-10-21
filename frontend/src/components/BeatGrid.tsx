import { useEffect, useMemo, useRef } from 'react'
import type { Segment } from '../lib/types.ts'

interface Props {
  segments: Segment[]; beats: number[]; downbeat: number; bpb: number; time: number; hideNames: boolean; marked?: boolean
  onSeek?: (t: number) => void
}

const W = 34 // ancho de cada tiempo, en píxeles
const HEAD = 0.3 // dónde queda «ahora» dentro de la barra (30 % desde la izquierda)
const PAD = 600 // espacio antes y después, para que el principio y el final también lleguen a «ahora»

/** Barra de tiempos de toda la canción: corre con la música como una cinta (el «ahora» queda fijo a la izquierda), con cada acorde
 *  escrito donde entra y ocupando hasta el siguiente. Se puede arrastrar para mirar adelante o atrás (a los 3 s vuelve sola) y
 *  tocar un tiempo para ir ahí. Con «Marcar pulso» usa los golpes marcados; si no, es una estimación. */
export default function BeatGrid({ segments, beats, downbeat, bpb, time, hideNames, marked, onSeek }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const userUntil = useRef(0)
  const n = beats.length
  const x = useMemo(() => (t: number) => {
    if (n < 2) return 0
    if (t <= beats[0]) return ((t - beats[0]) / (beats[1] - beats[0])) * W
    let lo = 0, hi = n - 1
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beats[m] <= t) lo = m; else hi = m }
    const d = beats[hi] - beats[lo]
    return (lo + Math.min(1.5, d > 0 ? (t - beats[lo]) / d : 0)) * W
  }, [beats, n])
  const labels = useMemo(() => segments.filter((s) => s.chord !== 'N' && s.end - s.start > 0.05).map((s) => {
    const a = x(s.start), b = x(s.end)
    return { a, w: Math.max(W * 0.8, b - a), chord: s.chord, start: s.start, end: s.end }
  }), [segments, x])

  useEffect(() => { // seguir la canción, salvo mientras el usuario está mirando otra parte
    const c = box.current
    if (!c || Date.now() < userUntil.current) return
    c.scrollLeft = PAD + x(time) - c.clientWidth * HEAD
  }, [time, x])

  if (n < 2) return null
  let cur = -1
  for (let i = 0; i < n - 1; i++) if (beats[i] <= time && time < beats[i + 1]) { cur = i; break }
  const holdUser = () => { userUntil.current = Date.now() + 3000 }
  const total = (n - 1) * W
  return (
    <div className="relative">
      <div ref={box} className="no-scrollbar overflow-x-auto" onPointerDown={holdUser} onTouchStart={holdUser} onWheel={holdUser} onPointerMove={(e) => { if (e.buttons) holdUser() }}
        role="group" aria-label={`Barra de tiempos${marked ? ' (pulso marcado)' : ' (estimada)'}`}>
        <div className="relative h-11" style={{ width: total + 2 * PAD }}>
          <div className="absolute inset-y-0" style={{ left: PAD, width: total }}>
          {beats.slice(0, -1).map((b, i) => {
            const one = ((((i - downbeat) % bpb) + bpb) % bpb) === 0
            return (
              <button key={i} type="button" tabIndex={-1} aria-label={`Ir a ${b.toFixed(1)} s`} onClick={() => onSeek?.(b)}
                className={`absolute top-0 h-11 overflow-hidden rounded-sm bg-panel ${one ? 'border-l-4 border-mute' : ''}`}
                style={{ left: i * W + 1, width: W - 2 }}>{i === cur && <span className="absolute inset-x-0 bottom-0 h-1.5 bg-accent" />}</button>
            )
          })}
          {labels.map((l, i) => (
            <span key={i} className={`pointer-events-none absolute top-0 flex h-11 items-center overflow-hidden whitespace-nowrap pl-1.5 font-bold leading-none
              ${l.chord.length > 4 ? 'text-sm' : 'text-lg'} ${time >= l.start && time < l.end ? 'text-accent' : ''}`}
              style={{ left: l.a, width: l.w }}>{hideNames ? '?' : l.chord}</span>
          ))}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute top-0 h-11 w-0.5 bg-fg" style={{ left: `${HEAD * 100}%` }} aria-hidden="true" />
      <p className="pt-0.5 text-right text-[10px] leading-none text-mute">{marked ? 'pulso marcado' : 'pulso estimado · «Acordes» → «Marcar pulso» para ajustarlo'}</p>
    </div>
  )
}
