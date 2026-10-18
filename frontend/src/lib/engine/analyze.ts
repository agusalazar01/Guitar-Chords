import type { Segment } from '../types.ts'
import { bassTrack, type BassTrack } from './bass.ts'
import { estimateDownbeat, onsetEnvelope, trackBeats } from './beats.ts'
import { computeChroma, computeSpectra, foldChroma, frameCenter, medianFilter } from './chroma.ts'
import { NOTES, QUALITIES, decodeChords, decodeTimed } from './decode.ts'
import { estimateKey, keyPrior } from './key.ts'

export const METHOD = 'stft-chroma-pulso-tonalidad-v0.4 (en el dispositivo)'
export interface AnalysisOutput {
  method: string; duration: number; segments: Segment[]; tuning: number
  beats: number[]; bpm: number | null; downbeat: number; beatsPerBar: number; key: string | null
  advanced: Segment[] // vocabulario extendido (7, maj7, m7, sus, dim, aug, 6, add9, 9): experimental
}
/** Parámetros elegidos con 4 canciones reales (ver README). offStay/onStay: probabilidad de mantener el acorde fuera/sobre un pulso. */
export const PARAMS = {
  keyBonus: 0.75, offStay: 0.99, onStay: 0.9, extPenalty: 1.2, minBeatStrength: 0.25,
  bassWeight: 0, chromaMin: 90, chromaMax: 700, inversionShare: 0.6, inversionMinSec: 0.8, inversionMinLow: 0.05,
}

/** Motor v0.1 (sin tonalidad, pulso ni bajo). Se conserva para medir mejoras. */
export function analyzeBaseline(samples: Float32Array, sampleRate: number): Segment[] {
  const { frames, hopSeconds } = computeChroma(samples, sampleRate)
  return decodeChords(medianFilter(frames, 5), hopSeconds)
}

/** Inversiones: si el bajo dominante del tramo es la 3ª o la 5ª del acorde, se nombra «Acorde/Bajo». */
export function addInversions(segs: Segment[], bt: BassTrack): Segment[] {
  return segs.map((s) => {
    const m = /^([A-G]#?)(.*)$/.exec(s.chord)
    if (!m || s.end - s.start < PARAMS.inversionMinSec) return s
    const q = QUALITIES.find((x) => x.suffix === m[2])
    if (!q) return s
    const v = new Float64Array(12)
    let w = 0, low = 0, n = 0
    for (let t = 0; t < bt.centers.length; t++) if (bt.centers[t] >= s.start && bt.centers[t] < s.end) {
      low += bt.lowShare[t]; n++
      if (bt.pcs[t] >= 0) { v[bt.pcs[t]] += bt.strength[t]; w += bt.strength[t] }
    }
    if (w <= 0 || !n || low / n < PARAMS.inversionMinLow) return s // sin graves audibles no se afirma una inversión
    let pc = 0
    for (let c = 1; c < 12; c++) if (v[c] > v[pc]) pc = c
    const rel = (pc - NOTES.indexOf(m[1]) + 12) % 12
    return rel !== 0 && q.iv.includes(rel) && v[pc] / w >= PARAMS.inversionShare ? { ...s, chord: `${s.chord}/${NOTES[pc]}` } : s
  })
}

/** Bajo por frame de croma: la nota grave más cercana en el tiempo, ponderada por su fuerza. */
function bassFrames(bt: BassTrack, centers: number[]): Float64Array[] {
  let j = 0
  return centers.map((c) => {
    while (j + 1 < bt.centers.length && Math.abs(bt.centers[j + 1] - c) <= Math.abs(bt.centers[j] - c)) j++
    const v = new Float64Array(12)
    if (bt.pcs[j] >= 0) v[bt.pcs[j]] = bt.strength[j]
    return v
  })
}

export function analyzeSamples(samples: Float32Array, sampleRate: number, onProgress?: (p: number) => void): AnalysisOutput {
  if (samples.length < sampleRate) throw new Error('El audio es demasiado corto para analizarlo (menos de 1 s).')
  const sp = computeSpectra(samples, sampleRate, onProgress)
  const chroma = medianFilter(foldChroma(sp, PARAMS.chromaMin, PARAMS.chromaMax), 5)
  const centers = chroma.map((_, t) => frameCenter(sp, t))
  onProgress?.(0.45)
  const duration = samples.length / sampleRate
  const hopSec = sp.hop / sampleRate
  const bt = bassTrack(samples, sampleRate)
  onProgress?.(0.6)

  const ons = onsetEnvelope(samples, sampleRate)
  const tr = trackBeats(ons.env, ons.hopSec, ons.offsetSec)
  onProgress?.(0.75)
  const usable = tr.beats.length >= 8 && tr.strength > PARAMS.minBeatStrength && tr.bpm !== null

  // Cada frame se etiqueta por el CENTRO de su ventana (antes, por el inicio: los cambios aparecían corridos).
  const times = centers.map((c) => c - hopSec / 2).concat([duration])
  times[0] = 0
  // Con pulso fiable, cambiar de acorde es más probable SOBRE un pulso, sin forzar los acordes a la rejilla.
  let stayAt: Float64Array | null = null
  if (usable) {
    stayAt = new Float64Array(chroma.length).fill(PARAMS.offStay)
    for (const b of tr.beats) {
      let lo = 0, hi = chroma.length - 1
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (times[m] <= b) lo = m; else hi = m - 1 }
      stayAt[Math.max(1, lo)] = PARAMS.onStay
    }
  }
  const key = estimateKey(chroma)
  const bass = PARAMS.bassWeight > 0 ? bassFrames(bt, centers) : null
  const run = (triadsOnly: boolean): Segment[] => addInversions(decodeTimed(chroma, times, {
    prior: keyPrior(key, PARAMS.keyBonus, triadsOnly ? 2 : QUALITIES.length), bass, bassWeight: PARAMS.bassWeight, bassGate: false,
    triadsOnly, extPenalty: PARAMS.extPenalty, stay: 0.995, stayAt,
  }), bt)
  const segments = run(true) // por defecto: mayores y menores (lo que mejor funciona en las mediciones)
  const advanced = run(false)

  let downbeat = 0
  if (usable) {
    const idx = segments.slice(1).map((s) => {
      let b = 0
      for (let i = 1; i < tr.beats.length; i++) if (Math.abs(tr.beats[i] - s.start) < Math.abs(tr.beats[b] - s.start)) b = i
      return Math.abs(tr.beats[b] - s.start) < 0.25 ? b : -1
    }).filter((i) => i >= 0)
    downbeat = estimateDownbeat(idx, 4)
  }
  onProgress?.(1)
  return {
    method: METHOD, duration, segments, advanced, tuning: sp.tuning, key: key ? key.name : null,
    beats: usable ? tr.beats : [], bpm: usable ? tr.bpm : null, downbeat, beatsPerBar: 4,
  }
}
