/** Referencias con tiempos (leídas de las grabaciones de Chordify) y utilidades de métrica. */
import type { Segment } from '../src/lib/types.ts'
const mk = (T: number[], L: string[], end: number): Segment[] => { if (T.length !== L.length) throw new Error('ref'); return L.map((c, i) => ({ start: T[i], end: i + 1 < T.length ? T[i + 1] : end, chord: c, confidence: null })) }
export const REF_NUEVE = mk([4.30, 8.00, 11.70, 19.10, 22.77, 26.47, 33.83, 37.53, 41.20, 44.90, 46.73, 48.60, 52.30, 54.13, 56.00, 59.67, 63.37],
  'Am Em D Am Em D Am Em D Em G D C Em D Am Em'.split(' '), 65.17)
export const REF_CARTA = mk('1.97 3.13 5.17 6.17 7.17 9.17 11.17 12.17 13.17 14.17 15.17 17.13 19.13 21.17 23.20 25.20 27.17 29.17 31.20 32.17 33.20 34.20 35.13 37.13 39.13 41.13 43.13 45.13 47.13 48.13 49.17 50.13 51.17 53.13 55.17 57.17 59.17 61.17 63.13 65.13 66.13 67.13 69.13 71.17 72.17 73.13 74.17'.split(' ').map(Number),
  'Cmaj7 Gmaj7 Dm7 G7 Cmaj7 Cm7 Bm7 E7 Am7 D7 Gmaj7 D7 Gmaj7 Am7 Bm7 E7 Am7 Cm7 Bm7 E7 Am7 D7 Gmaj7 Am7 Bm7 E7 Am7 Cm7 Bm7 E7 Am7 D7 Gmaj7 Bm7 Gmaj7 Bm7 Gmaj7 D7 Gmaj7 Dm7 G7 Cmaj7 Cm Bm7 E7 Am7 D7'.split(' '), 74.93)

const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const IV: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8], '6': [0, 4, 7, 9], add9: [0, 2, 4, 7], '9': [0, 2, 4, 7, 10] }
export function parse(c: string) { const m = /^([A-G]#?)(maj7|m7|sus2|sus4|dim|aug|add9|m|7|6|9)?(?:\/([A-G]#?))?$/.exec(c); if (!m) return null; const r = N.indexOf(m[1]), q = m[2] ?? ''; return { root: r, q, bass: m[3] ? N.indexOf(m[3]) : r, pcs: new Set(IV[q].map((i) => (r + i) % 12)) } }
const tri = (q: string) => (q === 'm' || q === 'm7' ? 'm' : ['', '7', 'maj7', '6', '9', 'add9'].includes(q) ? 'M' : q)
const at = (s: Segment[], t: number) => { let lo = 0, hi = s.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m].end <= t) lo = m + 1; else if (s[m].start > t) hi = m - 1; else return s[m].chord } return 'N' }

/** Métricas al estilo MIREX sobre la ventana de la referencia (paso 10 ms). */
export function evaluate(pred: Segment[], ref: Segment[]) {
  let n = 0, exact = 0, root = 0, majmin = 0, quality = 0, qualN = 0, overlap = 0, bassOk = 0
  for (let t = ref[0].start; t < ref[ref.length - 1].end; t += 0.01) {
    const r = parse(at(ref, t)), p = parse(at(pred, t)); if (!r) continue
    n++
    if (!p) continue
    if (p.root === r.root && p.q === r.q) exact++                 // acorde completo (sin contar la inversión: la referencia no la trae)
    if (p.root === r.root) { root++; qualN++; if (p.q === r.q) quality++ }
    if (p.root === r.root && tri(p.q) === tri(r.q)) majmin++
    if (p.bass === r.bass) bassOk++
    const inter = [...p.pcs].filter((x) => r.pcs.has(x)).length; overlap += inter / new Set([...p.pcs, ...r.pcs]).size
  }
  // segmentación: Hamming direccional (1 − sobre/sub-segmentación)
  const dh = (a: Segment[], b: Segment[]) => { let miss = 0, tot = 0; for (const s of a) { if (s.end <= ref[0].start || s.start >= ref[ref.length - 1].end) continue; const lo = Math.max(s.start, ref[0].start), hi = Math.min(s.end, ref[ref.length - 1].end); let best = 0; for (const u of b) best = Math.max(best, Math.max(0, Math.min(hi, u.end) - Math.max(lo, u.start))); miss += hi - lo - best; tot += hi - lo } return 1 - miss / tot }
  // retraso: cada cambio de referencia vs el cambio detectado más cercano (±1 s)
  const pb = pred.slice(1).map((s) => s.start), d: number[] = []
  for (let i = 1; i < ref.length; i++) { let best = Infinity; for (const b of pb) if (Math.abs(b - ref[i].start) < Math.abs(best)) best = b - ref[i].start; if (Math.abs(best) <= 1) d.push(best) }
  d.sort((a, b) => a - b)
  return {
    exact: exact / n, root: root / n, majmin: majmin / n, quality: qualN ? quality / qualN : 0, bass: bassOk / n, overlap: overlap / n,
    underSeg: 1 - dh(ref, pred), overSeg: 1 - dh(pred, ref), changesFound: d.length / (ref.length - 1),
    delayMed: d.length ? d[d.length >> 1] : NaN, absDelayMed: d.length ? d.map(Math.abs).sort((a, b) => a - b)[d.length >> 1] : NaN,
  }
}
