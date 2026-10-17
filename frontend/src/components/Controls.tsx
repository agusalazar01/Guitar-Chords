import { formatTime } from '../lib/youtube.ts'

interface Props {
  time: number; duration: number; playing: boolean
  onPlay: () => void; onPause: () => void; onSeek: (t: number) => void; onSkip: (d: number) => void
  onVolume: (v: number) => void; onRate: (r: number) => void; rate: number
  loop: { start: number; end: number } | null; onLoopStart: () => void; onLoopEnd: () => void; onLoopClear: () => void; onLoopRestart: () => void; rates: number[]
}

const btn = 'min-h-11 min-w-11 px-3 rounded-lg border border-line bg-panel font-semibold hover:border-accent'

export default function Controls(p: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="tabular-nums text-sm w-12 text-right">{formatTime(p.time)}</span>
        <input type="range" min={0} max={p.duration || 0} step={0.1} value={Math.min(p.time, p.duration || 0)}
          onChange={(e) => p.onSeek(Number(e.target.value))} aria-label="Posición en la canción" className="flex-1 accent-[var(--accent)]" />
        <span className="tabular-nums text-sm w-12">{formatTime(p.duration)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => p.onSeek(0)} aria-label="Ir al comienzo">⏮</button>
        <button className={btn} onClick={() => p.onSkip(-10)}>−10 s</button>
        <button className={btn} onClick={() => p.onSkip(-5)}>−5 s</button>
        <button className={`${btn} bg-accent text-accent-fg border-accent px-5`} onClick={p.playing ? p.onPause : p.onPlay}>
          {p.playing ? 'Pausar' : 'Reproducir'}
        </button>
        <button className={btn} onClick={() => p.onSkip(5)}>+5 s</button>
        <button className={btn} onClick={() => p.onSkip(10)}>+10 s</button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">Velocidad
          <select value={p.rate} onChange={(e) => p.onRate(Number(e.target.value))} className="min-h-9 rounded border border-line bg-panel px-2">
            {p.rates.map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">Volumen
          <input type="range" min={0} max={100} defaultValue={100} onChange={(e) => p.onVolume(Number(e.target.value))} className="w-24 accent-[var(--accent)]" />
        </label>
        <span className="flex items-center gap-2">
          <button className={btn} onClick={p.onLoopStart}>Inicio bucle</button>
          <button className={btn} onClick={p.onLoopEnd}>Fin bucle</button>
          {p.loop && <button className={btn} onClick={p.onLoopRestart}>Reiniciar bucle</button>}
          {p.loop && <button className={btn} onClick={p.onLoopClear}>Quitar</button>}
          {p.loop && <span className="tabular-nums">{formatTime(p.loop.start)}–{formatTime(p.loop.end)}</span>}
        </span>
      </div>
    </div>
  )
}
