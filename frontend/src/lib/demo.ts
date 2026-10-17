import type { Segment } from './types.ts'

/** SECUENCIA DE DEMOSTRACIÓN: no proviene de ningún análisis ni corresponde a ningún video. */
export const DEMO_SEGMENTS: Segment[] = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'].map((chord, i) => ({
  start: i * 4, end: (i + 1) * 4, chord, confidence: null,
}))
