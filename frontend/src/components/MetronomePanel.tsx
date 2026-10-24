import { useEffect, useState } from 'react'
import { METERS } from '../lib/cifrado.ts'
import { SOUNDS, type ClickSound, type Metronome } from '../lib/metronome.ts'

interface Props {
  met: Metronome; running: boolean; onRunning: (r: boolean) => void; onClose: () => void
  suggested: number | null // pulso de la canción (análisis del audio o golpes marcados)
  canFollow: boolean; follow: boolean; onFollow: (f: boolean) => void
}

const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } }

/** Metrónomo: se configura acá, se pone en marcha y se puede cerrar la pantalla: sigue sonando mientras se usa la canción. */
export default function MetronomePanel({ met, running, onRunning, onClose, suggested, canFollow, follow, onFollow }: Props) {
  const [bpm, setBpm] = useState(met.bpm)
  const [meter, setMeter] = useState(() => Object.keys(METERS).find((m) => METERS[m].bpb === met.bpb) ?? '4/4')
  const [sound, setSound] = useState<ClickSound>(met.sound)
  const [beat, setBeat] = useState(-1)
  useEffect(() => { met.bpm = bpm; save('metBpm', bpm) }, [bpm, met])
  useEffect(() => { met.bpb = METERS[meter].bpb; met.mid = METERS[meter].mid; save('metMeter', meter) }, [meter, met])
  useEffect(() => { met.sound = sound; save('metSound', sound) }, [sound, met])
  useEffect(() => { met.onBeat = setBeat; return () => { met.onBeat = null } }, [met])
  useEffect(() => { if (!running) setBeat(-1) }, [running])
  const add = (d: number) => setBpm((b) => Math.max(20, Math.min(300, b + d)))
  const bpb = METERS[meter].bpb
  const btn = 'grid h-14 w-14 place-items-center rounded-2xl bg-accent text-lg font-bold text-accent-fg active:scale-95 transition'
  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-bg px-4" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }} role="dialog" aria-label="Metrónomo">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Metrónomo</h2>
        <button className="btn" onClick={onClose}>{running ? 'Volver (sigue sonando)' : 'Cerrar'}</button>
      </div>
      <div className="card space-y-5">
        <div className="flex items-center justify-center gap-2">
          <button className={btn} onClick={() => add(-10)} disabled={follow}>−10</button>
          <button className={btn} onClick={() => add(-1)} disabled={follow}>−1</button>
          <div className="w-28 text-center"><p className="text-5xl font-extrabold text-accent">{bpm}</p><p className="text-xs text-mute">golpes por minuto</p></div>
          <button className={btn} onClick={() => add(1)} disabled={follow}>+1</button>
          <button className={btn} onClick={() => add(10)} disabled={follow}>+10</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-mute">Sonido
            <select className="field mt-1 w-full" value={sound} onChange={(e) => setSound(e.target.value as ClickSound)}>
              {Object.entries(SOUNDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-xs text-mute">Compás
            <select className="field mt-1 w-full" value={meter} onChange={(e) => setMeter(e.target.value)}>
              {Object.keys(METERS).map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        </div>
        <div className="flex justify-center">
          <button onClick={() => onRunning(!running)} aria-label={running ? 'Parar el metrónomo' : 'Poner en marcha el metrónomo'}
            className={`grid h-36 w-36 place-items-center rounded-full border-[10px] text-3xl font-extrabold transition-transform duration-75 ${running ? 'border-accent text-accent' : 'border-panel2 text-mute'} ${beat === 0 ? 'scale-105' : ''}`}>
            {running ? '■' : '▶'}</button>
        </div>
        <div className="flex flex-wrap justify-center gap-2" aria-hidden="true">
          {Array.from({ length: bpb }, (_, i) => (
            <span key={i} className={`rounded-xl border-4 transition-colors duration-75 ${i === 0 ? 'h-14 w-14' : 'h-12 w-12'} ${beat === i ? 'border-accent bg-accent' : 'border-panel2'}`} />))}
        </div>
      </div>
      {(suggested || canFollow) && (
        <div className="card space-y-2 text-sm">
          <h3 className="font-semibold">Con la canción</h3>
          {suggested && <div className="flex flex-wrap items-center gap-2">
            <span>Pulso sugerido: <b>{suggested} bpm</b></span>
            {suggested !== bpm && !follow && <button className="btn min-h-9 px-3" onClick={() => setBpm(suggested)}>Usar {suggested}</button>}
          </div>}
          {canFollow && <label className="flex items-center gap-2">
            <input type="checkbox" checked={follow} onChange={(e) => onFollow(e.target.checked)} />
            Ir con la canción: cuando suena, los golpes siguen los de la canción (y se acomodan si acelera o frena)</label>}
          <p className="text-xs text-mute">El pulso sugerido sale del análisis de tu audio (o de «Marcar pulso»). Si no te convence, cambialo con − y +.</p>
        </div>)}
    </div>
  )
}
