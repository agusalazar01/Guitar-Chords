/** Motor «IA + HMM»: probabilidades de notas de Basic Pitch → croma de agudos y de bajo → mismo decodificador (tonalidad + Viterbi). */
import type { Segment } from '../types.ts'
import type { BeatResult } from './beats.ts'
import { estimateDownbeat } from './beats.ts'
import { NOTES, QUALITIES, decodeTimed } from './decode.ts'
import { estimateKey, keyFromChords, keyPrior } from './key.ts'
import type { NoteFeatures } from './notes.ts'

/** Elegidos con 6 canciones (README). bassTones: una inversión (bajo en 3ª/5ª) también apoya al acorde; conc*: el bajo solo pesa cuando una nota grave domina. */
export const NPARAMS = {
  fuseWeight: 1, keyBonus: 0.75, offStay: 0.99, onStay: 0.9, extPenalty: 0.8, bassWeight: 0.5, beta: 12,
  bassTones: 0.9, concLo: 0.15, concHi: 0.35, inversionShare: 0.55, inversionMinSec: 0.6, minBassEnergy: 0.15,
}
export const NMETHOD = 'híbrido IA (Basic Pitch) + croma + HMM v0.5 (en el dispositivo)'

export interface NotesAnalysis { segments: Segment[]; advanced: Segment[]; key: string | null; downbeat: number }

/** Inversión si el bajo dominante del tramo es otra nota del acorde. */
function inversions(segs: Segment[], f: NoteFeatures): Segment[] {
  return segs.map((s) => {
    const m = /^([A-G]#?)(.*)$/.exec(s.chord)
    if (!m || s.end - s.start < NPARAMS.inversionMinSec) return s
    const q = QUALITIES.find((x) => x.suffix === m[2])
    if (!q) return s
    const v = new Float64Array(12)
    for (let t = 0; t < f.centers.length; t++) if (f.centers[t] >= s.start && f.centers[t] < s.end) for (let c = 0; c < 12; c++) v[c] += f.bass[t][c]
    const sum = v.reduce((a, b) => a + b, 0), n = f.centers.filter((c) => c >= s.start && c < s.end).length
    if (!n || sum / n < NPARAMS.minBassEnergy) return s
    let pc = 0
    for (let c = 1; c < 12; c++) if (v[c] > v[pc]) pc = c
    const rel = (pc - NOTES.indexOf(m[1]) + 12) % 12
    return rel !== 0 && q.iv.includes(rel) && v[pc] / sum >= NPARAMS.inversionShare ? { ...s, chord: `${s.chord}/${NOTES[pc]}` } : s
  })
}

export function analyzeNotes(f: NoteFeatures, duration: number, tr: BeatResult & { usable: boolean }): NotesAnalysis {
  const times = f.centers.map((c) => c - f.hopSec / 2).concat([duration])
  times[0] = 0
  let stayAt: Float64Array | null = null
  if (tr.usable) {
    stayAt = new Float64Array(f.treble.length).fill(NPARAMS.offStay)
    for (const b of tr.beats) {
      let lo = 0, hi = f.treble.length - 1
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (times[m] <= b) lo = m; else hi = m - 1 }
      stayAt[Math.max(1, lo)] = NPARAMS.onStay
    }
  }
  // Confianza en el bajo por cuadro: cuánto domina la nota más fuerte entre las graves (arpegios con bajo alternado → poca confianza).
  let bassWeightAt: Float64Array | null = null
  if (NPARAMS.concHi > NPARAMS.concLo) {
    bassWeightAt = new Float64Array(f.bass.length)
    for (let t = 0; t < f.bass.length; t++) {
      const b = f.bass[t], sum = b.reduce((x, y) => x + y, 0), mx = Math.max(...b)
      bassWeightAt[t] = sum > 0 ? Math.min(1, Math.max(0, (mx / sum - NPARAMS.concLo) / (NPARAMS.concHi - NPARAMS.concLo))) : 0
    }
  }
  const common = { stay: 0.995, stayAt, beta: NPARAMS.beta, bass: NPARAMS.bassWeight > 0 ? f.bass : null, bassWeight: NPARAMS.bassWeight, bassGate: false, bassTones: NPARAMS.bassTones, bassWeightAt }
  const first = decodeTimed(f.treble, times, { ...common, triadsOnly: true })
  const key = keyFromChords(first) ?? estimateKey(f.treble)
  const run = (triadsOnly: boolean) => inversions(decodeTimed(f.treble, times, {
    ...common, prior: keyPrior(key, NPARAMS.keyBonus, triadsOnly ? 2 : QUALITIES.length), triadsOnly, extPenalty: NPARAMS.extPenalty,
  }), f)
  const segments = run(true), advanced = run(false)
  let downbeat = 0
  if (tr.usable) {
    const idx = segments.slice(1).map((s) => {
      let b = 0
      for (let i = 1; i < tr.beats.length; i++) if (Math.abs(tr.beats[i] - s.start) < Math.abs(tr.beats[b] - s.start)) b = i
      return Math.abs(tr.beats[b] - s.start) < 0.25 ? b : -1
    }).filter((i) => i >= 0)
    downbeat = estimateDownbeat(idx, 4)
  }
  return { segments, advanced, key: key ? key.name : null, downbeat }
}

/** Une dos rasgos por cuadro (normalizados) sobre la rejilla de `base`: base/|base| + w · otro/|otro| (otro = cuadro más cercano en el tiempo). */
export function fuseFeatures(base: Float64Array[], baseCenters: number[], other: Float64Array[], otherCenters: number[], w: number): Float64Array[] {
  let j = 0
  return base.map((b, t) => {
    while (j + 1 < otherCenters.length && Math.abs(otherCenters[j + 1] - baseCenters[t]) <= Math.abs(otherCenters[j] - baseCenters[t])) j++
    const o = other[j] ?? new Float64Array(12), nb = Math.hypot(...b) || 1, no = Math.hypot(...o) || 1, e = (b.reduce((x, y) => x + y, 0) > 0 ? 1 : 0)
    const out = new Float64Array(12)
    for (let c = 0; c < 12; c++) out[c] = (b[c] / nb + (w * o[c]) / no) * e * nb // conserva la energía de base (detección de silencio)
    return out
  })
}
/** Reubica rasgos de otra rejilla en la de `centers` (cuadro más cercano). */
export function resample(frames: Float64Array[], from: number[], centers: number[]): Float64Array[] {
  let j = 0
  return centers.map((c) => { while (j + 1 < from.length && Math.abs(from[j + 1] - c) <= Math.abs(from[j] - c)) j++; return frames[j] ?? new Float64Array(12) })
}
