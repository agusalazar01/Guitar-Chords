/** Cromagrama por STFT (ventana de Hann), con estimación de afinación y compresión de magnitud. */
import { FFT } from './fft.ts'

export interface ChromaResult { frames: Float64Array[]; hopSeconds: number; tuning: number }

export function computeChroma(x: Float32Array, sr: number, onProgress?: (p: number) => void,
  N = 8192, hop = 2048, fMin = 90, fMax = 2200): ChromaResult {
  const T = x.length >= N ? Math.floor((x.length - N) / hop) + 1 : 0
  const fft = new FFT(N)
  const win = new Float64Array(N)
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  const kMin = Math.max(2, Math.ceil((fMin * N) / sr)), kMax = Math.min(N / 2 - 2, Math.floor((fMax * N) / sr))
  const nb = kMax - kMin + 1
  const re = new Float64Array(N), im = new Float64Array(N)
  const spectra: Float32Array[] = []
  const NH = 20, hist = new Float64Array(NH)
  for (let t = 0; t < T; t++) {
    const off = t * hop
    for (let i = 0; i < N; i++) { re[i] = x[off + i] * win[i]; im[i] = 0 }
    fft.transform(re, im)
    const s = new Float32Array(nb + 2) // con un bin de margen a cada lado, para detectar picos
    let mx = 0
    for (let k = kMin - 1; k <= kMax + 1; k++) { const v = Math.sqrt(Math.hypot(re[k], im[k])); s[k - kMin + 1] = v; if (v > mx) mx = v }
    spectra.push(s)
    for (let j = 1; j <= nb; j++) {
      const a = s[j - 1], b = s[j], c = s[j + 1]
      if (b > a && b >= c && b > 0.2 * mx) {
        const den = a - 2 * b + c
        const d = den !== 0 ? (0.5 * (a - c)) / den : 0
        const p = 12 * Math.log2((((kMin + j - 1 + d) * sr) / N) / 440)
        const dev = p - Math.round(p)
        hist[Math.min(NH - 1, Math.floor((dev + 0.5) * NH))] += b
      }
    }
    if (onProgress && t % 50 === 0) onProgress(0.5 * (t / T))
  }
  let bi = 0
  for (let i = 1; i < NH; i++) if (hist[i] > hist[bi]) bi = i
  const tuning = hist[bi] > 0 ? (bi + 0.5) / NH - 0.5 : 0
  const pc = new Uint8Array(nb), w = new Float64Array(nb)
  for (let j = 0; j < nb; j++) {
    const p = 12 * Math.log2((((kMin + j) * sr) / N) / 440) - tuning
    const r = Math.round(p)
    pc[j] = (((r + 9) % 12) + 12) % 12
    w[j] = Math.cos(Math.PI * (p - r)) ** 2
  }
  const frames: Float64Array[] = []
  for (let t = 0; t < T; t++) {
    const f = new Float64Array(12)
    for (let j = 0; j < nb; j++) f[pc[j]] += spectra[t][j + 1] * w[j]
    frames.push(f)
    if (onProgress && t % 50 === 0) onProgress(0.5 + 0.3 * (t / T))
  }
  return { frames, hopSeconds: hop / sr, tuning }
}

/** Filtro de mediana temporal por clase de altura (reduce transitorios). */
export function medianFilter(frames: Float64Array[], size = 5): Float64Array[] {
  const h = size >> 1, T = frames.length
  const out = frames.map(() => new Float64Array(12))
  const buf: number[] = []
  for (let t = 0; t < T; t++) {
    for (let c = 0; c < 12; c++) {
      buf.length = 0
      for (let k = Math.max(0, t - h); k <= Math.min(T - 1, t + h); k++) buf.push(frames[k][c])
      buf.sort((a, b) => a - b)
      out[t][c] = buf[buf.length >> 1]
    }
  }
  return out
}
