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
export function keyPrior(k: KeyEstimate | null, bonus: number, nq = 9): Float64Array {
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
