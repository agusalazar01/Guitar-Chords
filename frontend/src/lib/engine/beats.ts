/** Pulso y compás: envolvente de inicios (flujo espectral) + tempo por autocorrelación + seguimiento por programación dinámica (Ellis 2007). */
import { FFT } from './fft.ts'

export interface BeatResult { beats: number[]; bpm: number | null; strength: number }

export function onsetEnvelope(x: Float32Array, sr: number): { env: Float64Array; hopSec: number; offsetSec: number } {
  const N = 1024, hop = 512
  const T = x.length >= N ? Math.floor((x.length - N) / hop) + 1 : 0
  const fft = new FFT(N)
  const win = new Float64Array(N)
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  const kMax = Math.min(N / 2 - 1, Math.floor((4000 * N) / sr))
  const re = new Float64Array(N), im = new Float64Array(N)
  const prev = new Float64Array(kMax + 1)
  const env = new Float64Array(T)
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < N; i++) { re[i] = x[t * hop + i] * win[i]; im[i] = 0 }
    fft.transform(re, im)
    let flux = 0
    for (let k = 2; k <= kMax; k++) {
      const lm = Math.log(1 + (20 * Math.hypot(re[k], im[k])) / (N / 4))
      if (t > 0 && lm > prev[k]) flux += lm - prev[k]
      prev[k] = lm
    }
    env[t] = flux
  }
  // quitar la media local (~0,5 s) y normalizar
  const w = Math.max(3, Math.round(0.5 / (hop / sr))), cum = new Float64Array(T + 1)
  for (let t = 0; t < T; t++) cum[t + 1] = cum[t] + env[t]
  let sq = 0
  const out = new Float64Array(T)
  for (let t = 0; t < T; t++) {
    const a = Math.max(0, t - w), b = Math.min(T, t + w + 1)
    out[t] = Math.max(0, env[t] - (cum[b] - cum[a]) / (b - a)); sq += out[t] * out[t]
  }
  const sd = Math.sqrt(sq / Math.max(1, T)) || 1
  for (let t = 0; t < T; t++) out[t] /= sd
  return { env: out, hopSec: hop / sr, offsetSec: N / 2 / sr }
}

export function trackBeats(env: Float64Array, hopSec: number, offsetSec: number, bpmMin = 60, bpmMax = 180): BeatResult {
  const n = env.length
  const lMin = Math.max(2, Math.floor(60 / bpmMax / hopSec)), lMax = Math.ceil(60 / bpmMin / hopSec)
  if (n < lMax * 4) return { beats: [], bpm: null, strength: 0 }
  const mean = env.reduce((a, b) => a + b, 0) / n
  const e0 = env.map((v) => v - mean) // sin media: el ruido no debe parecer periodicidad
  const ac = new Float64Array(lMax + 2)
  for (let l = 0; l <= lMax + 1; l++) { let s = 0; for (let t = 0; t + l < n; t++) s += e0[t] * e0[t + l]; ac[l] = s / (n - l) }
  let best = lMin, bestV = -Infinity
  for (let l = lMin; l <= lMax; l++) {
    const bpm = 60 / (l * hopSec)
    const v = ac[l] * Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.9) ** 2) // preferencia por tempos cercanos a 110
    if (v > bestV) { bestV = v; best = l }
  }
  const a = ac[best - 1], b = ac[best], c = ac[best + 1], den = a - 2 * b + c
  const P = best + (den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0)
  const strength = ac[0] > 0 ? ac[best] / ac[0] : 0

  const score = new Float64Array(n), prev = new Int32Array(n).fill(-1)
  const w0 = Math.round(P / 2), w1 = Math.round(2 * P)
  for (let t = 0; t < n; t++) {
    let bs = -Infinity, bi = -1
    for (let d = w0; d <= w1; d++) {
      const u = t - d
      if (u < 0) break
      const v = score[u] - 100 * Math.log(d / P) ** 2
      if (v > bs) { bs = v; bi = u }
    }
    if (bi >= 0 && bs > 0) { score[t] = env[t] + bs; prev[t] = bi } else score[t] = env[t]
  }
  let end = Math.max(0, n - Math.round(P))
  for (let t = end; t < n; t++) if (score[t] > score[end]) end = t
  const frames: number[] = []
  for (let t = end; t >= 0; t = prev[t]) { frames.push(t); if (prev[t] < 0) break }
  frames.reverse()
  return { beats: frames.map((f) => f * hopSec + offsetSec), bpm: 60 / (P * hopSec), strength }
}

/** Posición dentro del compás para el tiempo t (null si aún no empieza el primer pulso). */
export function beatPosition(beats: number[], t: number, downbeat: number, bpb: number) {
  let lo = 0, hi = beats.length - 1, k = -1
  while (lo <= hi) { const m = (lo + hi) >> 1; if (beats[m] <= t) { k = m; lo = m + 1 } else hi = m - 1 }
  if (k < 0 || k >= beats.length - 1) return null
  const inBar = (((k - downbeat) % bpb) + bpb) % bpb
  return { index: k, inBar, frac: (t - beats[k]) / (beats[k + 1] - beats[k]), bar: Math.floor((k - downbeat) / bpb) + 1 }
}

/** El pulso del compás (tiempo 1) es el que más cambios de acorde concentra. */
export function estimateDownbeat(changeBeatIdx: number[], bpb = 4): number {
  const c = new Array<number>(bpb).fill(0)
  for (const i of changeBeatIdx) c[((i % bpb) + bpb) % bpb]++
  let best = 0
  for (let p = 1; p < bpb; p++) if (c[p] > c[best]) best = p
  return best
}

/** Mediana por clase de altura de los frames cuyo centro cae en cada intervalo [bounds[i], bounds[i+1]).
 *  La mediana (no la media) evita que el borde de una nota o un golpe de batería contamine el pulso. */
export function syncFrames(frames: Float64Array[], centers: number[], bounds: number[]): Float64Array[] {
  const out: Float64Array[] = []
  let k = 0
  for (let i = 0; i + 1 < bounds.length; i++) {
    while (k < frames.length && centers[k] < bounds[i]) k++
    let j = k
    while (j < frames.length && centers[j] < bounds[i + 1]) j++
    const idx: number[] = []
    for (let q = k; q < j; q++) idx.push(q)
    if (!idx.length && frames.length) idx.push(Math.min(frames.length - 1, Math.max(0, k)))
    const acc = new Float64Array(12)
    for (let c = 0; c < 12; c++) {
      const v = idx.map((q) => frames[q][c]).sort((x, y) => x - y)
      acc[c] = v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : 0
    }
    out.push(acc)
  }
  return out
}
