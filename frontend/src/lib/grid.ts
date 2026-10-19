// Compás estimado y acordes simplificados, para canciones sin análisis de audio (acordes de cancionero o marcados a mano).
import type { Segment } from './types.ts'

/** Pulso estimado a partir de cuándo cambian los acordes: el período (0,35–1,1 s) que mejor divide los intervalos entre cambios.
 *  Devuelve los tiempos de los pulsos desde el primer acorde, o [] si hay muy pocos cambios para estimar. */
export function estimateBeats(segments: Segment[], duration: number): number[] {
  const starts = segments.filter((s) => s.chord !== 'N').map((s) => s.start)
  if (starts.length < 4) return []
  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) { const d = starts[i] - starts[i - 1]; if (d > 0.3 && d < 12) gaps.push(d) }
  if (gaps.length < 3) return []
  const ps: number[] = [], sc: number[] = []
  for (let p = 1.1; p >= 0.35; p -= 0.005) {
    let s = 0
    for (const d of gaps) s += Math.cos((2 * Math.PI * d) / p)
    ps.push(p); sc.push(s / gaps.length)
  }
  const top = Math.max(...sc)
  // el período más largo que ajusta casi igual de bien (evita contar medios pulsos), afinado a su máximo local
  let i = sc.findIndex((v) => v >= top - 0.05)
  while (i + 1 < sc.length && sc[i + 1] >= sc[i]) i++
  const best = sc[i], bp = ps[i]
  if (!bp || best < 0.3) return []
  const out: number[] = []
  const end = Math.max(duration, starts[starts.length - 1] + 4)
  for (let t = starts[0]; t < end; t += bp) out.push(Math.round(t * 1000) / 1000)
  return out
}

/** Acorde simplificado: la tríada (mayor o menor), sin séptimas, novenas, sus ni bajo. dim y aug se conservan. */
export function simplifyChord(c: string): string {
  const m = /^([A-G][#b]?)(.*?)(\/[A-G][#b]?)?$/.exec(c)
  if (!m || c === 'N') return c
  const q = m[2]
  if (/^dim/.test(q)) return m[1] + 'dim'
  if (/^aug/.test(q)) return m[1] + 'aug'
  return m[1] + (/^m(?!aj)/.test(q) ? 'm' : '')
}
