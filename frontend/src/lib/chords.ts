import type { Segment } from './types.ts'

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' }

/** Segmento activo para el tiempo del reproductor. `offset` (s) desplaza los acordes respecto al video. */
export function findActiveIndex(segments: Segment[], time: number, offset = 0): number {
  const t = time - offset
  let lo = 0, hi = segments.length - 1, found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segments[mid].start <= t) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found >= 0 && t < segments[found].end ? found : -1
}

export function transposeChord(name: string, semitones: number): string {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name)
  if (!m) return name // "N" u otros: sin cambios
  const root = FLATS[m[1] + m[2]] ?? m[1] + m[2]
  const i = SHARPS.indexOf(root)
  if (i < 0) return name
  return SHARPS[(((i + semitones) % 12) + 12) % 12] + m[3]
}

export function transposeSegments(segments: Segment[], semitones: number): Segment[] {
  return semitones === 0 ? segments : segments.map((s) => ({ ...s, chord: transposeChord(s.chord, semitones) }))
}

/** Si hay bucle activo y se alcanzó su final, devuelve el tiempo al que saltar; si no, null. */
export function loopTarget(time: number, loop: { start: number; end: number } | null): number | null {
  if (!loop || loop.end <= loop.start) return null
  return time >= loop.end || time < loop.start - 0.5 ? loop.start : null
}
