import type { Segment } from '../types.ts'
import { estimateDownbeat, onsetEnvelope, syncFrames, trackBeats } from './beats.ts'
import { computeChroma, computeSpectra, foldChroma, frameCenter, medianFilter } from './chroma.ts'
import { decodeChords, decodeTimed } from './decode.ts'
import { estimateKey, keyPrior } from './key.ts'

export const METHOD = 'stft-chroma-pulso-tonalidad-v0.3 (en el dispositivo)'
export interface AnalysisOutput {
  method: string; duration: number; segments: Segment[]; tuning: number
  beats: number[]; bpm: number | null; downbeat: number; beatsPerBar: number; key: string | null
  advanced: Segment[] // vocabulario extendido (séptimas, sus, dim, aug): experimental
}
export const PARAMS = { keyBonus: 1.5, bassWeight: 0.3, beatStay: 0.85, extPenalty: 0.8 }

/** Motor v0.1 (sin tonalidad, pulso ni bajo). Se conserva para medir mejoras. */
export function analyzeBaseline(samples: Float32Array, sampleRate: number): Segment[] {
  const { frames, hopSeconds } = computeChroma(samples, sampleRate)
  return decodeChords(medianFilter(frames, 5), hopSeconds)
}

export function analyzeSamples(samples: Float32Array, sampleRate: number, onProgress?: (p: number) => void): AnalysisOutput {
  if (samples.length < sampleRate) throw new Error('El audio es demasiado corto para analizarlo (menos de 1 s).')
  const sp = computeSpectra(samples, sampleRate, onProgress)
  const chroma = medianFilter(foldChroma(sp, 90, 2200), 5)
  const bass = medianFilter(foldChroma(sp, 70, 250), 5)
  const centers = chroma.map((_, t) => frameCenter(sp, t))
  onProgress?.(0.5)
  const duration = samples.length / sampleRate

  const { env, hopSec, offsetSec } = onsetEnvelope(samples, sampleRate)
  const tr = trackBeats(env, hopSec, offsetSec)
  onProgress?.(0.7)
  const usable = tr.beats.length >= 8 && tr.strength > 0.25 && tr.bpm !== null

  let frames = chroma, bassF = bass, hopSeconds = sp.hop / sampleRate
  let times: number[] | null = null
  if (usable) {
    const P = 60 / (tr.bpm as number)
    const b = [...tr.beats]
    if (b[0] > 0.5 * P) b.unshift(0); else b[0] = 0
    if (duration - b[b.length - 1] > 0.5 * P) b.push(duration); else b[b.length - 1] = duration
    frames = syncFrames(chroma, centers, b); bassF = syncFrames(bass, centers, b); times = b
  }
  const key = estimateKey(frames)
  const run = (triadsOnly: boolean): Segment[] => {
    const opts = { prior: keyPrior(key, PARAMS.keyBonus, triadsOnly ? 2 : 9), bass: bassF, bassWeight: PARAMS.bassWeight, triadsOnly, extPenalty: PARAMS.extPenalty }
    return times ? decodeTimed(frames, times, { ...opts, stay: PARAMS.beatStay, minDuration: 0 }) : decodeChords(frames, hopSeconds, opts)
  }
  const segments = run(true) // por defecto: solo mayores y menores (lo que mejor funciona en las mediciones)
  const advanced = run(false)

  let downbeat = 0
  if (times) {
    const idx = segments.slice(1).map((s) => times!.findIndex((x) => Math.abs(x - s.start) < 1e-3)).filter((i) => i >= 0)
    downbeat = estimateDownbeat(idx, 4)
  }
  onProgress?.(1)
  return {
    method: METHOD, duration, segments, advanced, tuning: sp.tuning, key: key ? key.name : null,
    beats: usable ? tr.beats : [], bpm: usable ? tr.bpm : null, downbeat, beatsPerBar: 4,
  }
}
