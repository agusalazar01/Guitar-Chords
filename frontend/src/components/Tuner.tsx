import { useEffect, useRef, useState } from 'react'
import { GUITAR_STRINGS, NOTE_NAMES, detectPitch, noteOf } from '../lib/pitch.ts'

const loadA4 = () => { try { const v = Number(localStorage.getItem('tunerA4')); return v >= 400 && v <= 480 ? v : 440 } catch { return 440 } }

/** Afinador cromático: escucha el micrófono solo mientras está abierto (no graba ni manda nada) y muestra la nota (cifrado
 *  americano) y un círculo que va de izquierda (baja) a derecha (alta): rojo desafinado, verde y centrado cuando está afinada. */
export default function Tuner({ onClose }: { onClose: () => void }) {
  const [a4, setA4] = useState(loadA4)
  const [freq, setFreq] = useState<number | null>(null)
  const [live, setLive] = useState(false) // hay sonido ahora (si no, queda la última nota atenuada)
  const [err, setErr] = useState<string | null>(null)
  const hist = useRef<number[]>([])
  useEffect(() => { try { localStorage.setItem('tunerA4', String(a4)) } catch { /* sin almacenamiento */ } }, [a4])

  useEffect(() => {
    let stream: MediaStream | null = null, ctx: AudioContext | null = null, timer = 0, stop = false, quiet = 0
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no deja usar el micrófono.')
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return }
        ctx = new AudioContext()
        const an = ctx.createAnalyser(); an.fftSize = 4096
        ctx.createMediaStreamSource(stream).connect(an)
        const buf = new Float32Array(an.fftSize)
        timer = window.setInterval(() => {
          an.getFloatTimeDomainData(buf)
          const f = detectPitch(buf, ctx!.sampleRate)
          if (f) {
            quiet = 0
            const h = hist.current
            // si cambió de nota (otra cuerda), se empieza de nuevo; si no, mediana de las últimas lecturas (aguja estable)
            if (h.length && Math.abs(12 * Math.log2(f / h[h.length - 1])) > 0.7) h.length = 0
            h.push(f); if (h.length > 7) h.shift()
            setFreq([...h].sort((x, y) => x - y)[h.length >> 1]); setLive(true)
          } else if (++quiet > 12) { setLive(false); hist.current = [] }
        }, 50)
      } catch (e) {
        const m = (e as Error).name === 'NotAllowedError' ? 'No hay permiso para el micrófono. Permitilo en los ajustes del teléfono (o del navegador) y volvé a abrir el afinador.' : (e as Error).message || 'No se pudo abrir el micrófono.'
        setErr(m)
      }
    })()
    return () => { stop = true; clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); void ctx?.close() }
  }, [])

  const n = freq ? noteOf(freq, a4) : null
  const cents = n ? Math.max(-50, Math.min(50, n.cents)) : 0
  const ok = !!n && Math.abs(n.cents) <= 5
  const hue = n ? Math.max(0, 120 - Math.max(0, Math.abs(n.cents) - 5) * 4) : 0 // verde (120) → rojo (0) a los 35 cents
  const color = n ? `hsl(${hue} 75% 50%)` : 'var(--mute)'
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg px-4" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }} role="dialog" aria-label="Afinador">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Afinador</h2>
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
      {err ? <p role="alert" className="mt-6 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{err}</p> : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <p className={`text-[7rem] font-extrabold leading-none transition-opacity ${live ? '' : 'opacity-40'}`} style={{ color: n ? color : undefined }} aria-live="polite">
            {n ? n.name : '—'}</p>
          <div className="relative h-16 w-full max-w-md" aria-hidden="true">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-panel2" />
            <div className="absolute left-1/2 top-1 h-14 w-1 -translate-x-1/2 rounded-full" style={{ background: 'var(--mute)', opacity: 0.6 }} />
            <span className="absolute left-2 top-full mt-1 text-xs text-mute">baja</span>
            <span className="absolute right-2 top-full mt-1 text-xs text-mute">alta</span>
            <div className={`absolute top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg transition-all duration-150 ${live ? '' : 'opacity-40'}`}
              style={{ left: `${50 + (cents / 50) * 45}%`, background: color }} />
          </div>
          <p className="min-h-7 text-lg font-semibold" style={{ color: n ? color : undefined }}>
            {!n ? 'Tocá una cuerda' : ok ? '¡Afinada!' : n.cents < 0 ? 'Baja: apretá (tensá la cuerda)' : 'Alta: aflojá la cuerda'}</p>
          <p className="text-sm text-mute">{n && freq ? `${freq.toFixed(1)} Hz · ${n.cents > 0 ? '+' : ''}${Math.round(n.cents)} cents` : ' '}</p>
          <div className="flex gap-2" aria-label="Cuerdas de la guitarra (afinación estándar)">
            {GUITAR_STRINGS.map((m, i) => (
              <span key={i} className={`grid h-11 w-11 place-items-center rounded-full text-base font-bold ${n && n.midi === m ? (ok ? 'bg-green-600 text-white' : 'bg-accent text-accent-fg') : 'bg-panel text-mute'}`}>
                {NOTE_NAMES[m % 12]}</span>))}
          </div>
        </div>)}
      <div className="card flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-mute">La de referencia:</span>
        <button className="btn min-h-9 px-3" onClick={() => setA4((v) => Math.max(400, v - 1))} aria-label="Bajar la referencia 1 Hz">−</button>
        <b className="w-16 text-center">{a4} Hz</b>
        <button className="btn min-h-9 px-3" onClick={() => setA4((v) => Math.min(480, v + 1))} aria-label="Subir la referencia 1 Hz">+</button>
        {a4 !== 440 && <button className="btn min-h-9 px-3" onClick={() => setA4(440)}>Volver a 440</button>}
      </div>
    </div>
  )
}
