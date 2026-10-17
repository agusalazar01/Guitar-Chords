import type { Segment } from './types.ts'

const MIN = 0.1 // duración mínima de un segmento (s)
const round = (x: number) => Math.round(x * 100) / 100

export function setChordAt(segs: Segment[], i: number, chord: string): Segment[] {
  return segs.map((s, k) => (k === i ? { ...s, chord, confidence: null } : s))
}

/** Mueve el inicio del segmento i (y el final del anterior): nunca deja huecos ni solapes. */
export function moveStart(segs: Segment[], i: number, t: number): Segment[] {
  if (i < 0 || i >= segs.length) return segs
  const lo = i === 0 ? 0 : segs[i - 1].start + MIN
  const hi = segs[i].end - MIN
  if (hi < lo) return segs
  const v = round(Math.min(Math.max(t, lo), hi))
  return segs.map((s, k) => (k === i ? { ...s, start: v } : k === i - 1 ? { ...s, end: v } : s))
}

/** Mueve el final del segmento i (y el inicio del siguiente). */
export function moveEnd(segs: Segment[], i: number, t: number): Segment[] {
  if (i < 0 || i >= segs.length) return segs
  const lo = segs[i].start + MIN
  const hi = i === segs.length - 1 ? Infinity : segs[i + 1].end - MIN
  if (hi < lo) return segs
  const v = round(Math.min(Math.max(t, lo), hi))
  return segs.map((s, k) => (k === i ? { ...s, end: v } : k === i + 1 ? { ...s, start: v } : s))
}

/** Divide el segmento i en t (útil para añadir un cambio de acorde omitido). */
export function splitAt(segs: Segment[], i: number, t: number): Segment[] {
  const s = segs[i]
  if (!s || t <= s.start + MIN || t >= s.end - MIN) return segs
  const v = round(t)
  return [...segs.slice(0, i), { ...s, end: v }, { ...s, start: v }, ...segs.slice(i + 1)]
}

/** Elimina el segmento i; su tiempo pasa al anterior (o al siguiente si es el primero). */
export function removeAt(segs: Segment[], i: number): Segment[] {
  if (segs.length <= 1 || i < 0 || i >= segs.length) return segs
  const out = segs.filter((_, k) => k !== i)
  if (i > 0) out[i - 1] = { ...out[i - 1], end: segs[i].end }
  else out[0] = { ...out[0], start: segs[i].start }
  return out
}
