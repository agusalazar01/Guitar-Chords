/** Canciones sintéticas con banda (guitarra rasgueada, bajo, batería, melodía) para medir el motor. NO son canciones reales. */
import { NOTES } from './decode.ts'

export const SR = 22050
export function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
export function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()) }

export interface SynthOptions { bpm: number; bars: string[]; repeats: number; seed: number; noise?: number; drums?: boolean; melody?: boolean }
export interface Truth { start: number; end: number; chord: string }

const IV: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8] }
const pcsOf = (name: string) => {
  const m = /^([A-G]#?)(maj7|m7|sus2|sus4|dim|aug|m|7)?$/.exec(name)!
  const r = NOTES.indexOf(m[1])
  return { r, tones: IV[m[2] ?? ''].map((i) => (r + i) % 12) }
}
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

export function synthSong(o: SynthOptions) {
  const r = rng(o.seed), beat = 60 / o.bpm
  const bars = Array.from({ length: o.repeats }, () => o.bars).flat()
  const total = Math.floor(bars.length * 4 * beat * SR)
  const y = new Float32Array(total)
  const truth: Truth[] = []
  const tonic = pcsOf(o.bars[0]).r
  const minorKey = /^[A-G]#?m(?!aj)/.test(o.bars[0])
  const scale = (minorKey ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map((d) => (tonic + d) % 12)
  const add = (hz: number, t0: number, dur: number, amp: number, harm: number, decay: number) => {
    const s0 = Math.floor(t0 * SR), n = Math.min(Math.floor(dur * SR), total - s0)
    for (let h = 1; h <= harm; h++) {
      const f = hz * h
      if (f > 5000) break
      for (let i = 0; i < n; i++) y[s0 + i] += (amp / h) * Math.exp(-(i / SR) / decay) * Math.sin((2 * Math.PI * f * i) / SR)
    }
  }
  bars.forEach((chord, b) => {
    const { r: root, tones } = pcsOf(chord)
    truth.push({ start: b * 4 * beat, end: (b + 1) * 4 * beat, chord })
    const bassMidi = 40 + (((root - 40) % 12) + 12) % 12
    const mids = tones.map((pc) => 55 + (((pc - 55) % 12) + 12) % 12)
    for (let k = 0; k < 4; k++) {
      const t0 = (b * 4 + k) * beat
      if (k % 2 === 0) add(midiHz(bassMidi), t0, beat * 2, 0.9, 5, 0.5)
      mids.forEach((m, i) => add(midiHz(m), t0 + i * 0.012, beat, k === 0 ? 0.5 : 0.35, 6, 0.4))
      if (o.melody !== false) {
        const m = 67 + ((scale[Math.floor(r() * 7)] - 67 + 120) % 12)
        add(midiHz(m), t0, beat * 0.9, 0.45, 3, 0.6)
      }
      if (o.drums !== false) {
        const s0 = Math.floor(t0 * SR)
        for (let i = 0; i < Math.floor(0.12 * SR) && s0 + i < total; i++) {
          const e = Math.exp(-(i / SR) / 0.03)
          y[s0 + i] += (k % 2 === 0 ? 0.8 * Math.sin(2 * Math.PI * 60 * (i / SR)) : 0.5 * gauss(r)) * e
        }
        for (let h = 0; h < 2; h++) { // hi-hat a corcheas
          const hs = s0 + Math.floor(h * beat * 0.5 * SR)
          for (let i = 0; i < Math.floor(0.03 * SR) && hs + i < total; i++) y[hs + i] += 0.15 * gauss(r) * Math.exp(-(i / SR) / 0.01)
        }
      }
    }
  })
  const nz = o.noise ?? 0.05
  for (let i = 0; i < total; i++) y[i] += nz * gauss(r)
  return { samples: y, sr: SR, truth, bpm: o.bpm }
}

/** Precisión por tramos de 0,1 s (se ignora el primer segundo de arranque). */
export function frameAccuracy(truth: Truth[], pred: { start: number; end: number; chord: string }[], step = 0.1) {
  const at = (arr: { start: number; end: number; chord: string }[], t: number) => arr.find((s) => t >= s.start && t < s.end)?.chord ?? 'N'
  const end = truth[truth.length - 1].end
  let ok = 0, n = 0
  for (let t = 0.5; t < end - 0.1; t += step) { n++; if (at(truth, t) === at(pred, t)) ok++ }
  return ok / n
}
