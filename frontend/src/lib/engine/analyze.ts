import type { Segment } from '../types.ts'
import { computeChroma, medianFilter } from './chroma.ts'
import { decodeChords } from './decode.ts'

export const METHOD = 'stft-chroma-templates-v0.1 (en el dispositivo)'
export interface AnalysisOutput { method: string; duration: number; segments: Segment[]; tuning: number }

export function analyzeSamples(samples: Float32Array, sampleRate: number, onProgress?: (p: number) => void): AnalysisOutput {
  if (samples.length < sampleRate) throw new Error('El audio es demasiado corto para analizarlo (menos de 1 s).')
  const { frames, hopSeconds, tuning } = computeChroma(samples, sampleRate, onProgress)
  const segments = decodeChords(medianFilter(frames, 5), hopSeconds)
  onProgress?.(1)
  return { method: METHOD, duration: samples.length / sampleRate, segments, tuning }
}
