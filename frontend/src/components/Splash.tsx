import { useEffect, useState } from 'react'
import { FlagUY, Mate, Notebook } from './Art.tsx'
import { APP_VERSION } from '../lib/version.ts'

/** Pantalla de carga: un segundo con el cuaderno y el mate, el nombre, la versión y la autoría. Después se desvanece. */
export default function Splash({ minMs = 1000 }: { minMs?: number }) {
  const [phase, setPhase] = useState<'on' | 'out' | 'off'>(() => (new URLSearchParams(location.search).has('selftest') ? 'off' : 'on'))
  useEffect(() => {
    if (phase !== 'on') return
    const a = setTimeout(() => setPhase('out'), minMs)
    return () => clearTimeout(a)
  }, [phase, minMs])
  useEffect(() => {
    if (phase !== 'out') return
    const b = setTimeout(() => setPhase('off'), 380)
    return () => clearTimeout(b)
  }, [phase])
  if (phase === 'off') return null
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-bg text-fg ${phase === 'out' ? 'splash-out' : ''}`}
      role="status" aria-label="Mi Cancionero se está abriendo" onClick={() => setPhase('out')}>
      <div className="flex items-end gap-3 text-mute">
        <Notebook size={92} />
        <Mate size={74} />
      </div>
      <h1 className="mt-5 text-4xl font-extrabold tracking-tight">Mi Cancionero</h1>
      <p className="mt-1 text-mute">Tus canciones, tus acordes</p>
      <div className="absolute inset-x-0 text-center text-[11px] leading-relaxed text-mute" style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <p className="text-xs font-bold text-accent">v{APP_VERSION}</p>
        <p className="inline-flex flex-wrap items-center justify-center gap-1 px-4">Idea y diseño: Agustín Salazar · Hecha con Claude · Uruguay <FlagUY /></p>
      </div>
    </div>
  )
}
