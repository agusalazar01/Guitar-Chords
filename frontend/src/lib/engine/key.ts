import { NOTES, Q } from './decode.ts'

export interface KeyEstimate { tonic: number; minor: boolean; score: number; name: string }
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function corr(a: number[], b: number[]) {
  const ma = a.reduce((x, y) => x + y, 0) / 12, mb = b.reduce((x, y) => x + y, 0) / 12
  let n = 0, da = 0, db = 0
  for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2 }
  return da && db ? n / Math.sqrt(da * db) : 0
}

/** Tonalidad por perfiles de Krumhansl–Schmuckler sobre el cromagrama medio (cada frame normalizado). */
/** Correlación de cada tonalidad (índice tónica*2 + menor) con el cromagrama medio. */
export function profileScores(frames: Float64Array[]): Float64Array | null {
  const v = new Array<number>(12).fill(0)
  let used = 0
  for (const f of frames) { const n = Math.hypot(...f); if (n <= 0) continue; for (let i = 0; i < 12; i++) v[i] += f[i] / n; used++ }
  if (!used) return null
  const out = new Float64Array(24)
  for (let t = 0; t < 12; t++) for (const minor of [false, true]) { const prof = minor ? MIN : MAJ; out[t * 2 + (minor ? 1 : 0)] = corr(v, Array.from({ length: 12 }, (_, i) => prof[(i - t + 12) % 12])) }
  return out
}

export function estimateKey(frames: Float64Array[]): KeyEstimate | null {
  const v = new Array<number>(12).fill(0)
  let used = 0
  for (const f of frames) {
    const n = Math.hypot(...f)
    if (n <= 0) continue
    for (let i = 0; i < 12; i++) v[i] += f[i] / n
    used++
  }
  if (!used) return null
  let best: KeyEstimate | null = null
  for (let t = 0; t < 12; t++) for (const minor of [false, true]) {
    const prof = (minor ? MIN : MAJ), rot = Array.from({ length: 12 }, (_, i) => prof[(i - t + 12) % 12])
    const s = corr(v, rot)
    if (!best || s > best.score) best = { tonic: t, minor, score: s, name: `${NOTES[t]} ${minor ? 'menor' : 'mayor'}` }
  }
  return best
}

/** Bonificación (log-emisión) por acordes diatónicos (tríadas y séptimas); índice = raíz*nq + calidad. */
export function keyPrior(k: KeyEstimate | null, bonus: number, nq = 12): Float64Array {
  const p = new Float64Array(12 * nq)
  if (!k) return p
  const scale = Math.max(0, Math.min(1, (k.score - 0.2) / 0.4)) * bonus
  const set = (deg: number, qs: number[], w: number) => { for (const q of qs) if (q < nq) p[((k.tonic + deg) % 12) * nq + q] = w * scale }
  if (!k.minor) {
    set(0, [Q.maj, Q.maj7], 1); set(2, [Q.min, Q.min7], 1); set(4, [Q.min, Q.min7], 1); set(5, [Q.maj, Q.maj7], 1)
    set(7, [Q.maj, Q.dom7], 1); set(9, [Q.min, Q.min7], 1); set(10, [Q.maj], 0.5)
  } else {
    set(0, [Q.min, Q.min7], 1); set(3, [Q.maj, Q.maj7], 1); set(5, [Q.min, Q.min7], 1); set(7, [Q.min, Q.min7], 1)
    set(7, [Q.maj, Q.dom7], 0.7); set(8, [Q.maj, Q.maj7], 1); set(10, [Q.maj, Q.dom7], 1)
  }
  return p
}

/** Tonalidad a partir de una primera pasada de acordes: la tonalidad cuyos acordes diatónicos cubren más tiempo.
 *  Más robusta que los perfiles cuando la voz o el bajo sesgan el cromagrama medio. */
export const KEYCFG = { firstChordBonus: 0 } // desactivado: con «Carta para no llorar» (empieza en el IV) elegía mal la tonalidad

export function keyFromChords(segs: { start: number; end: number; chord: string }[], profile: Float64Array | null = null, profileWeight = 0): KeyEstimate | null {
  const dur = new Float64Array(24) // raíz*2 + (menor ? 1 : 0)
  let total = 0
  for (const s of segs) {
    const m = /^([A-G]#?)(m?)(?![a-z0-9])/.exec(s.chord)
    if (!m) continue
    const d = s.end - s.start
    dur[NOTES.indexOf(m[1]) * 2 + (m[2] ? 1 : 0)] += d; total += d
  }
  if (total <= 0) return null
  // Las canciones suelen empezar en la tónica: el primer acorde estable (≥ 1 s) sirve para desempatar I/IV o mayor/relativa menor.
  const first = segs.find((x) => x.chord !== 'N' && x.end - x.start >= 1)
  const fm = first ? /^([A-G]#?)(m?)(?![a-z0-9])/.exec(first.chord) : null
  const firstIdx = fm ? NOTES.indexOf(fm[1]) * 2 + (fm[2] ? 1 : 0) : -1
  let best: KeyEstimate | null = null
  for (let t = 0; t < 12; t++) for (const minor of [false, true]) {
    // grados de la tonalidad relativa mayor (la menor comparte acordes): I ii iii IV V vi
    const T = minor ? (t + 3) % 12 : t
    const dia: [number, number, number][] = [[0, 0, 1], [2, 1, 0.8], [4, 1, 0.6], [5, 0, 1], [7, 0, 1], [9, 1, 1], [10, 0, 0.3]]
    let sc = 0
    for (const [deg, mi, w] of dia) sc += w * dur[((T + deg) % 12) * 2 + mi]
    // desempate mayor/relativa menor: peso del acorde de tónica
    sc += 0.5 * dur[t * 2 + (minor ? 1 : 0)]
    const score = sc / total + (profile ? profileWeight * profile[t * 2 + (minor ? 1 : 0)] : 0) + (firstIdx === t * 2 + (minor ? 1 : 0) ? KEYCFG.firstChordBonus : 0)
    if (!best || score > best.score) best = { tonic: t, minor, score, name: `${NOTES[t]} ${minor ? 'menor' : 'mayor'}` }
  }
  return best && { ...best, score: Math.min(1, best.score) } // se recorta solo al final (antes el recorte rompía la comparación)
}
