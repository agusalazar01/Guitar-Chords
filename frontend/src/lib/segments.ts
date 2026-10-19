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

/** Marca «desde t suena este acorde» (modo para videos de YouTube: se toca el acorde cuando empieza).
 *  Los segmentos cubren [0, duración]; antes del primer acorde marcado queda «N» (sin acorde). */
export function markChordAt(segs: Segment[], t: number, chord: string, duration: number): Segment[] {
  const v = round(Math.max(0, t)), end = Math.max(duration, v + 1)
  if (!segs.length) return v > MIN ? [{ start: 0, end: v, chord: 'N', confidence: null }, { start: v, end, chord, confidence: null }] : [{ start: 0, end, chord, confidence: null }]
  let out = segs
  const last = out[out.length - 1]
  if (last.end < end) out = [...out.slice(0, -1), { ...last, end }]
  const i = out.findIndex((s) => v >= s.start && v < s.end)
  if (i < 0) return out
  const s = out[i]
  if (v - s.start < MIN) return s.chord === chord ? out : setChordAt(out, i, chord)
  if (s.chord === chord) return out
  const split = splitAt(out, i, v)
  return split === out ? out : setChordAt(split, i + 1, chord)
}

/** Próximo cambio a marcar en «Marcar cambios»: el primer acorde (no silencio) que empieza después del que suena en t. */
export function nextChange(segs: Segment[], t: number): number {
  let cur = -1
  for (let i = 0; i < segs.length; i++) if (segs[i].start <= t) cur = i
  for (let i = cur + 1; i < segs.length; i++) if (segs[i].chord !== 'N') return i
  return -1
}

/** «Acá cambia»: el acorde j pasa a empezar en t y todo lo que sigue se corre lo mismo (mantiene sus duraciones hasta que el
 *  usuario marque el próximo cambio). Lo anterior termina en t; los silencios que quedan en el medio se quitan. null si t cae
 *  antes del comienzo del acorde anterior (no se puede marcar un cambio hacia atrás de otro ya marcado). */
export function retimeAt(segs: Segment[], j: number, t: number): Segment[] | null {
  if (j < 0 || j >= segs.length) return null
  let prev = j - 1
  while (prev >= 0 && segs[prev].chord === 'N' && segs[prev].start >= t - MIN) prev--
  if (prev >= 0 && t < segs[prev].start + MIN) return null
  const d = t - segs[j].start
  const out: Segment[] = []
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (i < j) {
      if (s.start >= t - MIN / 2) continue // silencios que quedaron después del cambio
      out.push({ ...s, end: i === j - 1 || s.end > t ? round(t) : s.end })
    } else out.push({ ...s, start: round(s.start + d), end: round(s.end + d) })
  }
  // el anterior que quedó termina justo en t (sin huecos)
  const k = out.findIndex((s) => s.start === round(t) && s.chord === segs[j].chord)
  if (k > 0) out[k - 1] = { ...out[k - 1], end: round(t) }
  return out
}
