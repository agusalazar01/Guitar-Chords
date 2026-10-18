/** Seguimiento del bajo: saliencia armónica de la fundamental (C2–G3) con ventana larga (≈0,74 s). */
import { FFT } from './fft.ts'

export interface BassTrack { pcs: Int8Array; strength: Float32Array; lowShare: Float32Array; centers: number[] }

export function bassTrack(x: Float32Array, sr: number, N = 16384, hop = 2048): BassTrack {
  const T = x.length >= N ? Math.floor((x.length - N) / hop) + 1 : 0
  const fft = new FFT(N)
  const win = new Float64Array(N)
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  const re = new Float64Array(N), im = new Float64Array(N)
  const binHz = sr / N, maxBin = Math.floor(1000 / binHz)
  const mag = new Float32Array(maxBin + 2)
  const pcs = new Int8Array(T), strength = new Float32Array(T), lowShare = new Float32Array(T), centers: number[] = []
  const k60 = Math.ceil(60 / binHz), k200 = Math.floor(200 / binHz)
  const peak = (f: number) => { // máximo dentro de ±media semitono alrededor de f
    const lo = Math.max(1, Math.floor((f * 0.971) / binHz)), hi = Math.min(maxBin, Math.ceil((f * 1.029) / binHz))
    let m = 0
    for (let k = lo; k <= hi; k++) if (mag[k] > m) m = mag[k]
    return m
  }
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < N; i++) { re[i] = x[t * hop + i] * win[i]; im[i] = 0 }
    fft.transform(re, im)
    for (let k = 0; k <= maxBin + 1; k++) mag[k] = Math.sqrt(Math.hypot(re[k], im[k]))
    let low = 0, all = 0
    for (let k = k60; k <= maxBin; k++) { const e = mag[k] * mag[k]; all += e; if (k <= k200) low += e }
    lowShare[t] = all > 0 ? low / all : 0 // cuánto pesan los graves (60–200 Hz) frente a 60–1000 Hz
    let best = -1, bv = 0, tot = 0
    for (let m = 36; m <= 55; m++) {
      const f0 = 440 * 2 ** ((m - 69) / 12)
      let s = 0
      for (let h = 1; h <= 4; h++) s += peak(h * f0) * 0.8 ** (h - 1)
      tot += s
      if (s > bv) { bv = s; best = m }
    }
    pcs[t] = best >= 0 ? best % 12 : -1
    strength[t] = tot > 0 ? bv / tot : 0
    centers.push((t * hop + N / 2) / sr)
  }
  return { pcs, strength, lowShare, centers }
}
