import type { Diagram } from '../lib/types.ts'

const X0 = 40, DX = 24, Y0 = 52, DY = 34, ROWS = 5

export default function DiagramView({ d, small = false }: { d: Diagram; small?: boolean }) {
  const sx = (i: number) => X0 + i * DX
  const row = (fret: number) => Y0 + (fret - d.base_fret) * DY + DY / 2
  const barred = (i: number, f: number) => d.barre && f === d.barre.fret && i >= d.barre.from_string && i <= d.barre.to_string
  return (
    <svg viewBox="0 0 200 240" role="img" className={`w-full mx-auto ${small ? 'max-w-[84px]' : 'max-w-[200px]'}`}
      aria-label={`Diagrama de ${d.chord}: ${d.frets.map((f) => (f < 0 ? 'no tocar' : f === 0 ? 'al aire' : `traste ${f}`)).join(', ')}`}>
      {d.base_fret === 1
        ? <line x1={X0 - 2} x2={sx(5) + 2} y1={Y0} y2={Y0} stroke="var(--fg)" strokeWidth="6" />
        : <text x="6" y={Y0 + DY / 2 + 5} fontSize="14" fill="var(--mute)">{d.base_fret}</text>}
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line key={r} x1={X0} x2={sx(5)} y1={Y0 + r * DY} y2={Y0 + r * DY} stroke="var(--mute)" strokeWidth="1.5" />
      ))}
      {d.frets.map((_, i) => <line key={i} x1={sx(i)} x2={sx(i)} y1={Y0} y2={Y0 + ROWS * DY} stroke="var(--mute)" strokeWidth="1.5" />)}
      {d.barre && (
        <rect x={sx(d.barre.from_string) - 8} width={sx(d.barre.to_string) - sx(d.barre.from_string) + 16}
          y={row(d.barre.fret) - 9} height="18" rx="9" fill="var(--fg)" />
      )}
      {d.frets.map((f, i) => {
        if (f < 0) return <text key={i} x={sx(i)} y="38" textAnchor="middle" fontSize="16" fill="var(--mute)">×</text>
        if (f === 0) return <circle key={i} cx={sx(i)} cy="32" r="6" fill="none" stroke="var(--fg)" strokeWidth="2" />
        if (barred(i, f)) return null
        return (
          <g key={i}>
            <circle cx={sx(i)} cy={row(f)} r="10" fill="var(--accent)" />
            {d.fingers[i] > 0 && <text x={sx(i)} y={row(f) + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--accent-fg)">{d.fingers[i]}</text>}
          </g>
        )
      })}
      {!small && <text x="100" y="232" textAnchor="middle" fontSize="11" fill="var(--mute)">6ª cuerda a la izquierda</text>}
    </svg>
  )
}
