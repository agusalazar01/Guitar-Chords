/** Decodificación de acordes desde un cromagrama: plantillas de tríadas + coseno + Viterbi (+ estado "N"). */
import type { Segment } from '../types.ts'

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function buildTemplates(): { names: string[]; tpl: Float64Array[] } {
  const names: string[] = [], tpl: Float64Array[] = []
  for (let root = 0; root < 12; root++) {
    for (const [suffix, iv] of [['', [0, 4, 7]], ['m', [0, 3, 7]]] as [string, number[]][]) {
      const v = new Float64Array(12)
      for (const i of iv) v[(root + i) % 12] = 1 / Math.sqrt(3)
      names.push(NOTES[root] + suffix); tpl.push(v)
    }
  }
  return { names, tpl }
}

export interface DecodeOptions { stay?: number; beta?: number; silenceRatio?: number; minDuration?: number }

/** frames[t] = 12 energías (sin normalizar). */
export function decodeChords(frames: Float64Array[], hopSeconds: number, o: DecodeOptions = {}): Segment[] {
  const { stay = 0.995, beta = 12, silenceRatio = 0.12, minDuration = 0.3 } = o
  const T = frames.length
  if (T === 0) return []
  const energy = frames.map((f) => f.reduce((a, b) => a + b, 0))
  const sorted = [...energy].sort((a, b) => a - b)
  const ref = sorted[Math.min(T - 1, Math.floor(0.95 * (T - 1)))]
  const silent = energy.map((e) => (ref <= 0 ? e <= 0 : e < silenceRatio * ref))
  const { names, tpl } = buildTemplates()
  const nc = names.length, n = nc + 1
  const sim = new Float32Array(T * nc)
  for (let t = 0; t < T; t++) {
    let nrm = 0
    for (let i = 0; i < 12; i++) nrm += frames[t][i] * frames[t][i]
    nrm = Math.sqrt(nrm) || 1
    for (let s = 0; s < nc; s++) {
      let d = 0
      for (let i = 0; i < 12; i++) d += tpl[s][i] * frames[t][i]
      sim[t * nc + s] = Math.min(1, Math.max(0, d / nrm))
    }
  }
  const emis = (t: number, out: Float64Array) => {
    let m = -Infinity
    for (let s = 0; s < nc; s++) { out[s] = silent[t] ? 0 : beta * sim[t * nc + s]; m = Math.max(m, out[s]) }
    out[nc] = silent[t] ? beta * 1.5 : 0; m = Math.max(m, out[nc])
    let sum = 0
    for (let s = 0; s < n; s++) sum += Math.exp(out[s] - m)
    const lse = m + Math.log(sum)
    for (let s = 0; s < n; s++) out[s] -= lse
  }
  const logStay = Math.log(stay), logMove = Math.log((1 - stay) / (n - 1))
  const back = new Uint8Array(T * n)
  let delta = new Float64Array(n), next = new Float64Array(n)
  const e = new Float64Array(n)
  emis(0, e); delta.set(e)
  for (let t = 1; t < T; t++) {
    let prev = 0
    for (let s = 1; s < n; s++) if (delta[s] > delta[prev]) prev = s
    const move = delta[prev] + logMove
    emis(t, e)
    for (let s = 0; s < n; s++) {
      const st = delta[s] + logStay
      if (st >= move) { back[t * n + s] = s; next[s] = st + e[s] } else { back[t * n + s] = prev; next[s] = move + e[s] }
    }
    ;[delta, next] = [next, delta]
  }
  const path = new Uint8Array(T)
  let best = 0
  for (let s = 1; s < n; s++) if (delta[s] > delta[best]) best = s
  path[T - 1] = best
  for (let t = T - 1; t > 0; t--) path[t - 1] = back[t * n + path[t]]

  const r3 = (x: number) => Math.round(x * 1000) / 1000
  const segs: Segment[] = []
  for (let i = 0; i < T;) {
    let j = i
    while (j + 1 < T && path[j + 1] === path[i]) j++
    const st = path[i]
    let chord = 'N', conf: number | null = null
    if (st !== nc) { chord = names[st]; let a = 0; for (let t = i; t <= j; t++) a += sim[t * nc + st]; conf = r3(a / (j - i + 1)) }
    segs.push({ start: r3(i * hopSeconds), end: r3((j + 1) * hopSeconds), chord, confidence: conf })
    i = j + 1
  }
  const merged: Segment[] = []
  for (const s of segs) {
    if (merged.length && s.end - s.start < minDuration) merged[merged.length - 1].end = s.end
    else merged.push(s)
  }
  return merged
}
