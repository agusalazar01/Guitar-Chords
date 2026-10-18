/** Decodificación de acordes desde un cromagrama: plantillas de tríadas + coseno + Viterbi (+ estado "N"). */
import type { Segment } from '../types.ts'

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export interface QualityDef { suffix: string; iv: number[]; ext: boolean }
/** Los dos primeros son tríadas; el resto son "extendidos" y pagan una penalización (deben ganar con evidencia clara). */
export const QUALITIES: QualityDef[] = [
  { suffix: '', iv: [0, 4, 7], ext: false }, { suffix: 'm', iv: [0, 3, 7], ext: false },
  { suffix: '7', iv: [0, 4, 7, 10], ext: true }, { suffix: 'maj7', iv: [0, 4, 7, 11], ext: true },
  { suffix: 'm7', iv: [0, 3, 7, 10], ext: true }, { suffix: 'sus2', iv: [0, 2, 7], ext: true },
  { suffix: 'sus4', iv: [0, 5, 7], ext: true }, { suffix: 'dim', iv: [0, 3, 6], ext: true }, { suffix: 'aug', iv: [0, 4, 8], ext: true },
  { suffix: '6', iv: [0, 4, 7, 9], ext: true }, { suffix: 'add9', iv: [0, 2, 4, 7], ext: true }, { suffix: '9', iv: [0, 2, 4, 7, 10], ext: true },
]
export const Q = { maj: 0, min: 1, dom7: 2, maj7: 3, min7: 4, sus2: 5, sus4: 6, dim: 7, aug: 8, six: 9, add9: 10, nine: 11 }

/** Estado = raíz * nq + calidad. */
export function buildTemplates(nq = QUALITIES.length): { names: string[]; tpl: Float64Array[]; ext: boolean[] } {
  const names: string[] = [], tpl: Float64Array[] = [], ext: boolean[] = []
  for (let root = 0; root < 12; root++) {
    for (let q = 0; q < nq; q++) {
      const v = new Float64Array(12)
      for (const i of QUALITIES[q].iv) v[(root + i) % 12] = 1 / Math.sqrt(QUALITIES[q].iv.length)
      names.push(NOTES[root] + QUALITIES[q].suffix); tpl.push(v); ext.push(QUALITIES[q].ext)
    }
  }
  return { names, tpl, ext }
}

export interface DecodeOptions {
  stay?: number; beta?: number; silenceRatio?: number; minDuration?: number
  prior?: Float64Array | null // bonificación por acorde (p. ej. tonalidad)
  bass?: Float64Array[] | null; bassWeight?: number // cromagrama de graves: apoya la raíz del acorde
  triadsOnly?: boolean; extPenalty?: number // vocabulario y penalización de acordes extendidos
  bassGate?: boolean // true: el peso del bajo se atenúa si hay pocos graves; false: el bajo ya viene normalizado
  stayAt?: Float64Array | null // prob. de mantener el acorde al entrar en cada frame (más baja sobre los pulsos)
}

/** frames uniformes: frames[t] = 12 energías (sin normalizar), separados `hopSeconds`. */
export function decodeChords(frames: Float64Array[], hopSeconds: number, o: DecodeOptions = {}): Segment[] {
  return decodeTimed(frames, Array.from({ length: frames.length + 1 }, (_, i) => i * hopSeconds), o)
}

/** times[i]..times[i+1] = intervalo del frame i (admite intervalos irregulares, p. ej. pulsos). */
export function decodeTimed(frames: Float64Array[], times: number[], o: DecodeOptions = {}): Segment[] {
  const { stay = 0.995, beta = 12, silenceRatio = 0.12, minDuration = 0.3, prior = null, bass = null, bassWeight = 0, triadsOnly = false, extPenalty = 1.5, stayAt = null, bassGate = true } = o
  const nq = triadsOnly ? 2 : QUALITIES.length
  const T = frames.length
  if (T === 0) return []
  const energy = frames.map((f) => f.reduce((a, b) => a + b, 0))
  const sorted = [...energy].sort((a, b) => a - b)
  const ref = sorted[Math.min(T - 1, Math.floor(0.95 * (T - 1)))]
  const silent = energy.map((e) => (ref <= 0 ? e <= 0 : e < silenceRatio * ref))
  const { names, tpl, ext } = buildTemplates(nq)
  const nc = names.length, n = nc + 1
  const sim = new Float32Array(T * nc) // coseno puro (confianza)
  const score = new Float32Array(T * nc) // coseno + apoyo del bajo (decisión)
  for (let t = 0; t < T; t++) {
    let nrm = 0
    for (let i = 0; i < 12; i++) nrm += frames[t][i] * frames[t][i]
    nrm = Math.sqrt(nrm) || 1
    let bmax = 0, bsum = 0, fsum = 0
    if (bass) for (let i = 0; i < 12; i++) { bmax = Math.max(bmax, bass[t][i]); bsum += bass[t][i]; fsum += frames[t][i] }
    // el apoyo del bajo solo cuenta si hay graves audibles frente al resto del espectro
    const bw = !bass ? 0 : bassGate ? (fsum > 0 ? bassWeight * Math.min(1, bsum / (0.35 * fsum)) : 0) : (bsum > 0 ? bassWeight : 0)
    for (let s = 0; s < nc; s++) {
      let d = 0
      for (let i = 0; i < 12; i++) d += tpl[s][i] * frames[t][i]
      const c = Math.min(1, Math.max(0, d / nrm))
      sim[t * nc + s] = c
      score[t * nc + s] = bass && bmax > 0 ? (1 - bw) * c + bw * (bass[t][Math.floor(s / nq)] / bmax) : c
    }
  }
  const emis = (t: number, out: Float64Array) => {
    let m = -Infinity
    for (let s = 0; s < nc; s++) { out[s] = silent[t] ? 0 : beta * score[t * nc + s] + (prior ? prior[s] : 0) - (ext[s] ? extPenalty : 0); m = Math.max(m, out[s]) }
    out[nc] = silent[t] ? beta * 1.5 : 0; m = Math.max(m, out[nc])
    let sum = 0
    for (let s = 0; s < n; s++) sum += Math.exp(out[s] - m)
    const lse = m + Math.log(sum)
    for (let s = 0; s < n; s++) out[s] -= lse
  }
  const logStay = Math.log(stay), logMove = Math.log((1 - stay) / 24) // costo de cambio independiente del tamaño del vocabulario
  const back = new Uint8Array(T * n)
  let delta = new Float64Array(n), next = new Float64Array(n)
  const e = new Float64Array(n)
  emis(0, e); delta.set(e)
  for (let t = 1; t < T; t++) {
    let prev = 0
    for (let s = 1; s < n; s++) if (delta[s] > delta[prev]) prev = s
    const ls = stayAt ? Math.log(stayAt[t]) : logStay
    const move = delta[prev] + (stayAt ? Math.log((1 - stayAt[t]) / 24) : logMove)
    emis(t, e)
    for (let s = 0; s < n; s++) {
      const st = delta[s] + ls
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
    segs.push({ start: r3(times[i]), end: r3(times[j + 1]), chord, confidence: conf })
    i = j + 1
  }
  const merged: Segment[] = []
  for (const s of segs) {
    if (merged.length && s.end - s.start < minDuration) merged[merged.length - 1].end = s.end
    else merged.push(s)
  }
  return merged
}
