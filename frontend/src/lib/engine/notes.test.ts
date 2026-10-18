import test from 'node:test'
import assert from 'node:assert/strict'
import { BP, bpRowTime, bpUnwrap, bpWindowCount, bpWindows, noteChroma } from './notes.ts'

test('ventanas iguales a basic_pitch.get_audio_input (relleno, paso y cantidad)', () => {
  const x = Float32Array.from({ length: 100000 }, (_, i) => i + 1)
  const { windows } = bpWindows(x), ol = BP.overlapFrames * BP.hop, step = BP.nSamples - ol
  assert.equal(windows.length, Math.ceil((x.length + ol / 2) / step))
  assert.equal(windows[0][ol / 2 - 1], 0); assert.equal(windows[0][ol / 2], 1) // primeros ol/2 ceros
  assert.equal(windows[1][0], step - ol / 2 + 1)
  assert.equal(windows[windows.length - 1][BP.nSamples - 1], 0) // última ventana rellena con ceros
  assert.equal(bpWindowCount(x.length).count, windows.length)
})
test('unión de salidas y tiempos sin deriva', () => {
  const win = new Float32Array(172 * BP.keys).fill(1)
  const rows = bpUnwrap([win, win, win], 300)
  assert.equal(rows.length, 300) // 142 por ventana (426), recortado a nFrames
  assert.ok(Math.abs(bpRowTime(142) - (BP.nSamples - BP.overlapFrames * BP.hop) / BP.sr) < 1e-9) // la 2ª ventana empieza en un paso
})
test('croma de notas: La3 + Do#4 + Mi4 → A, C#, E', () => {
  const r = new Float32Array(BP.keys); for (const m of [57, 61, 64]) r[m - BP.firstMidi] = 1
  const f = noteChroma(Array.from({ length: 16 }, () => r))
  assert.equal(f.treble.length, 2)
  const top = [...f.treble[0]].map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => x[1]).sort((a, b) => a - b)
  assert.deepEqual(top, [1, 4, 9])
})
