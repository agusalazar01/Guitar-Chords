import { formatTime } from '../lib/youtube.ts'

interface Props {
  time: number; duration: number; playing: boolean
  onPlay: () => void; onPause: () => void; onSeek: (t: number) => void; onSkip: (d: number) => void
  onVolume: (v: number) => void; onRate: (r: number) => void; rate: number; rates: number[]
  loop: { start: number; end: number } | null; onLoopCycle: () => void
  children?: React.ReactNode // el video / reproductor, a la derecha
}
const sm = 'min-h-10 rounded-lg border border-line bg-bg text-xs font-semibold'

export default function Controls(p: Props) {
  const loopSet = !!p.loop && p.loop.end > p.loop.start
  const loopLabel = !p.loop ? 'Bucle: inicio' : !loopSet ? 'Bucle: fin' : `Quitar bucle ${formatTime(p.loop.start)}–${formatTime(p.loop.end)}`
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-10 text-right text-xs tabular-nums">{formatTime(p.time)}</span>
        <input type="range" min={0} max={p.duration || 0} step={0.1} value={Math.min(p.time, p.duration || 0)}
          onChange={(e) => p.onSeek(Number(e.target.value))} aria-label="Posición en la canción" className="flex-1 accent-[var(--accent)]" />
        <span className="w-10 text-xs tabular-nums">{formatTime(p.duration)}</span>
      </div>
      <div className="grid grid-cols-2 items-start gap-3">
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-3">
            <button className="grid h-12 w-12 place-items-center rounded-full border border-line bg-bg" onClick={() => p.onSeek(0)} aria-label="Ir al comienzo">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg></button>
            <button className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-fg" onClick={p.playing ? p.onPause : p.onPlay} aria-label={p.playing ? 'Pausar' : 'Reproducir'}>
              {p.playing ? <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                : <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current"><path d="M7 4v16l13-8z" /></svg>}</button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button className={sm} onClick={() => p.onSkip(-10)} aria-label="Retroceder 10 segundos">−10</button>
            <button className={sm} onClick={() => p.onSkip(-5)} aria-label="Retroceder 5 segundos">−5</button>
            <button className={sm} onClick={() => p.onSkip(5)} aria-label="Adelantar 5 segundos">+5</button>
            <button className={sm} onClick={() => p.onSkip(10)} aria-label="Adelantar 10 segundos">+10</button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button className={`${sm} ${loopSet ? 'border-accent text-accent' : ''}`} onClick={p.onLoopCycle}>{loopLabel}</button>
            <select value={p.rate} onChange={(e) => p.onRate(Number(e.target.value))} aria-label="Velocidad" className={`${sm} px-1`}>
              {p.rates.map((r) => <option key={r} value={r}>{r}×</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-mute">Volumen
            <input type="range" min={0} max={100} defaultValue={100} onChange={(e) => p.onVolume(Number(e.target.value))} className="min-w-0 flex-1 accent-[var(--accent)]" />
          </label>
        </div>
        <div>{p.children}</div>
      </div>
    </div>
  )
}
