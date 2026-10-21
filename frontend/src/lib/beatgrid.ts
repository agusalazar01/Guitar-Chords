import type { Segment } from './types.ts'

const TOL = 0.08 // un acorde que entra apenas antes del golpe cuenta para ese golpe

/** Cada acorde que entra en un tiempo (entre ese golpe y el siguiente), en orden. */
export function beatLabels(segments: Segment[], beats: number[], from: number, count: number): string[][] {
  const out: string[][] = []
  for (let i = from; i < from + count; i++) {
    if (i < 0 || i >= beats.length - 1) { out.push([]); continue }
    const a = beats[i] - TOL, b = beats[i + 1] - TOL
    out.push(segments.filter((s) => s.start >= a && s.start < b && s.end - s.start > 0.05).map((s) => s.chord))
  }
  return out
}

