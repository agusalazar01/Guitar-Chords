import { readFileSync } from 'node:fs'
import { onsetEnvelope } from '../src/lib/engine/beats.ts'
import type { Segment } from '../src/lib/types.ts'

export const SR = 22050
export const loadF32 = (name: string) => { const b = readFileSync(`${process.env.EVAL_DIR ?? "eval-audio"}/${name}.f32`); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FL: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' }
export const pcOf = (n: string) => NOTES.indexOf(FL[n] ?? n)

/** Acordes de cada cancionero (nivel tríada; formas escritas). shift = semitonos de afinación real (Buenas noches: -1). */
export const SONGS: Record<string, { name: string; file: string; allowed: string[]; shift: number; seq: string[] }> = {
  oscura: { name: 'La noche está muy oscura', file: 'La_Noche_Esta__Muy_Oscura_audio', shift: 0,
    allowed: ['G', 'D', 'C', 'Em', 'B'],
    seq: 'G D C G G D C G  G D C G D C G  C G D G C G D G B Em D G'.split(/\s+/) },
  capsulas: { name: 'Cápsulas', file: 'Ca_psulas_audio', shift: 0,
    allowed: ['G', 'C', 'D', 'Am', 'Em', 'F'],
    seq: 'G C G C G  G C D  Am C Em  G C D  Am C Em  F Am Em  C D  G C G C G'.split(/\s+/) },
  muchacho: { name: 'Canción de muchacho', file: 'Cancio_n_de_Muchacho_audio', shift: 0,
    allowed: ['Em', 'C', 'D', 'G', 'A', 'D#'], seq: ['Em', 'C', 'D', 'G'] },
  buenas: { name: 'Buenas noches (guitarra 1/2 tono abajo)', file: 'Buenas_Noches_audio', shift: -1,
    allowed: ['E', 'F#m', 'Am', 'A', 'B', 'D'],
    seq: 'E F#m Am E A Am E B A E E E A F#m D A E D A'.split(/\s+/) },
}
export function triad(label: string): string | null {
  const m = /^([A-G]#?)(maj7|m7|sus2|sus4|dim|aug|add9|m|7|6|9)?(?:\/[A-G]#?)?$/.exec(label)
  if (!m) return null
  const q = m[2] ?? ''
  return m[1] + (q === 'm' || q === 'm7' ? 'm' : ['', '7', 'maj7', '6', '9', 'add9'].includes(q) ? '' : '?')
}
export const shiftChord = (c: string, by: number) => { const m = /^([A-G]#?)(.*)$/.exec(c); return m ? NOTES[(pcOf(m[1]) + by + 12) % 12] + m[2] : c }
export const allowedSounding = (k: string) => new Set(SONGS[k].allowed.map((c) => shiftChord(c, SONGS[k].shift)))

export function metrics(k: string, segs: Segment[], samples: Float32Array) {
  const allowed = allowedSounding(k), dur = samples.length / SR
  let tAll = 0, tOk = 0, tN = 0
  const seen = new Set<string>(), share = new Map<string, number>()
  for (const s of segs) {
    const d = s.end - s.start
    if (s.chord === 'N') { tN += d; continue }
    const t = triad(s.chord); tAll += d
    if (t && allowed.has(t)) { tOk += d; seen.add(t) }
    share.set(s.chord, (share.get(s.chord) ?? 0) + d)
  }
  const { env, hopSec, offsetSec } = onsetEnvelope(samples, SR)
  const delays: number[] = []
  for (let i = 1; i < segs.length; i++) {
    if (segs[i].chord === 'N' || segs[i - 1].chord === 'N') continue
    const b = segs[i].start; let best = -1, bv = 0
    for (let f = Math.max(1, Math.floor((b - 0.5 - offsetSec) / hopSec)); f <= Math.min(env.length - 2, Math.ceil((b + 0.5 - offsetSec) / hopSec)); f++) if (env[f] > bv && env[f] >= env[f - 1] && env[f] >= env[f + 1]) { bv = env[f]; best = f }
    if (best >= 0 && bv > 1.5) delays.push(b - (best * hopSec + offsetSec))
  }
  delays.sort((a, b) => a - b)
  const q = (p: number) => (delays.length ? delays[Math.floor(p * (delays.length - 1))] : NaN)
  return {
    okShare: tOk / Math.max(1e-9, tAll), noChordShare: tN / dur, coverage: `${seen.size}/${allowed.size}`,
    segPerMin: (segs.length / dur) * 60, short: segs.filter((s) => s.end - s.start < 0.4).length / Math.max(1, segs.length),
    delayMed: q(0.5), absDelayMed: delays.length ? [...delays].map(Math.abs).sort((a, b) => a - b)[Math.floor(delays.length / 2)] : NaN, nDelay: delays.length,
    top: [...share.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, t]) => `${c}:${((t / dur) * 100).toFixed(0)}%`).join(' '),
  }
}
const lcs = (a: string[], b: string[]) => { const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]); return d[a.length][b.length] }
const collapse = (a: string[]) => a.filter((c, i) => i === 0 || c !== a[i - 1])
export function score(k: string, segs: Segment[], x: Float32Array) {
  const m = metrics(k, segs, x)
  const det = collapse(segs.filter((s) => s.chord !== 'N').map((s) => triad(s.chord) ?? '?'))
  const ref = collapse(SONGS[k].seq.map((c) => shiftChord(c, SONGS[k].shift)))
  const l = lcs(det, ref), rec = l / ref.length, pre = l / Math.max(1, det.length)
  return { ...m, f1: ref.length > 6 ? (2 * rec * pre) / Math.max(1e-9, rec + pre) : NaN, nDet: det.length, nRef: ref.length }
}
