/** Rasgos armónicos a partir de un «pianorrol» de probabilidades de notas (p. ej. Basic Pitch: 88 teclas desde A0, ~86 cuadros/s). */
export const BP = { sr: 22050, hop: 256, nSamples: 43844, overlapFrames: 30, keys: 88, firstMidi: 21 } as const
export const bpFrameSec = BP.hop / BP.sr
const FRAMES_PER_WIN = 2 * 86 - BP.overlapFrames, STEP = BP.nSamples - BP.overlapFrames * BP.hop
/** Tiempo real de la fila j ya unida: cada ventana aporta 142 cuadros pero solo avanza 141,27 (sin esto hay ~0,5 s de deriva por minuto). */
export const bpRowTime = (j: number) => (Math.floor(j / FRAMES_PER_WIN) * STEP + (j % FRAMES_PER_WIN) * BP.hop) / BP.sr

/** Ventanas de entrada del modelo (idéntico a basic_pitch.inference.get_audio_input), generadas de a una para no ocupar memoria. */
export function bpWindowCount(nSamples: number): { count: number; nFrames: number } {
  const ol = BP.overlapFrames * BP.hop, step = BP.nSamples - ol, padded = ol / 2 + nSamples
  return { count: Math.ceil(padded / step), nFrames: Math.floor((nSamples / step) * (2 * 86 - BP.overlapFrames)) }
}
export function bpWindow(x: Float32Array, i: number): Float32Array {
  const ol = BP.overlapFrames * BP.hop, step = BP.nSamples - ol
  const w = new Float32Array(BP.nSamples)
  const start = i * step - ol / 2 // posición en x (el relleno inicial de ol/2 ceros queda implícito)
  for (let k = 0; k < BP.nSamples; k++) { const j = start + k; if (j >= 0 && j < x.length) w[k] = x[j] }
  return w
}
export function bpWindows(x: Float32Array): { windows: Float32Array[]; nFrames: number } {
  const { count, nFrames } = bpWindowCount(x.length)
  return { windows: Array.from({ length: count }, (_, i) => bpWindow(x, i)), nFrames }
}

/** Une las salidas por ventana (172×88 cada una) quitando la mitad del solapamiento a cada lado (= unwrap_output). */
export function bpUnwrap(outs: Float32Array[], nFrames: number): Float32Array[] {
  const h = BP.overlapFrames / 2, rows: Float32Array[] = []
  for (const o of outs) {
    const nf = o.length / BP.keys
    for (let f = h; f < nf - h && rows.length < nFrames; f++) rows.push(o.subarray(f * BP.keys, (f + 1) * BP.keys))
  }
  return rows
}

export interface NoteFeatures { treble: Float64Array[]; bass: Float64Array[]; centers: number[]; hopSec: number }

/** Promedia `group` cuadros y pliega en 12 clases de altura: agudos (≥ splitMidi) y graves (< splitMidi, la nota más grave pesa más). */
export function noteChroma(rows: Float32Array[], group = 8, splitMidi = 48, power = 1, minMidi = 21, maxMidi = 108): NoteFeatures {
  const treble: Float64Array[] = [], bass: Float64Array[] = [], centers: number[] = []
  for (let s = 0; s + 1 <= rows.length; s += group) {
    const e = Math.min(rows.length, s + group), t = new Float64Array(12), b = new Float64Array(12)
    for (let f = s; f < e; f++) {
      const r = rows[f]
      let lowestSeen = false
      for (let k = 0; k < BP.keys; k++) {
        const midi = BP.firstMidi + k
        if (midi < minMidi || midi > maxMidi) continue
        const p = r[k] ** power, pc = midi % 12
        if (midi >= splitMidi) t[pc] += p
        else { b[pc] += p * (lowestSeen ? 0.5 : 1); if (r[k] > 0.3) lowestSeen = true; t[pc] += 0.5 * p }
      }
    }
    for (let c = 0; c < 12; c++) { t[c] /= e - s; b[c] /= e - s }
    treble.push(t); bass.push(b); centers.push((bpRowTime(s) + bpRowTime(e - 1)) / 2 + bpFrameSec / 2)
  }
  return { treble, bass, centers, hopSec: group * bpFrameSec }
}

/** Mismo audio que tools/ci-model-check.ts y la referencia de Python: C3 C4 E4 G4 con 3 armónicos, 5 s, sin ruido. */
export function selfTestSignal(): Float32Array {
  const n = BP.sr * 5, y = new Float32Array(n)
  for (const m of [48, 60, 64, 67]) {
    const f = 440 * 2 ** ((m - 69) / 12)
    for (const [h, a] of [[1, 1], [2, 0.5], [3, 0.25]]) for (let i = 0; i < n; i++) y[i] += 0.12 * a * Math.sin((2 * Math.PI * f * h * i) / BP.sr)
  }
  return y
}

