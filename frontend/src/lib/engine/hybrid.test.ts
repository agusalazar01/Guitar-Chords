import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeHybrid } from './analyze.ts'
import { BP, bpRowTime, bpWindowCount } from './notes.ts'
import { frameAccuracy, synthSong } from './synth.ts'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
test('motor híbrido: con notas «perfectas» del modelo y audio de banda, acierta acordes y tiempos (incluye bajo)', () => {
  const s = synthSong({ bpm: 100, bars: ['G', 'D', 'Em', 'C'], repeats: 2, seed: 9, noise: 0.08 })
  // filas como las daría el modelo: tríada en la octava 4 y la raíz como bajo en la octava 2
  const n = bpWindowCount(s.samples.length).nFrames
  const rows = Array.from({ length: n }, (_, j) => {
    const t = bpRowTime(j), seg = s.truth.find((x) => t >= x.start && t < x.end), r = new Float32Array(BP.keys)
    if (seg) {
      const m = /^([A-G]#?)(m?)$/.exec(seg.chord)!, root = NOTES.indexOf(m[1])
      for (const iv of [0, m[2] ? 3 : 4, 7]) r[60 + ((root + iv) % 12) - BP.firstMidi] = 0.9
      r[36 + root - BP.firstMidi] = 0.9
    }
    return r
  })
  const out = analyzeHybrid(s.samples, s.sr, rows)
  assert.ok(frameAccuracy(s.truth, out.segments) > 0.9, JSON.stringify(out.segments.map((x) => [x.start, x.chord])))
  assert.match(out.method, /IA/)
})
