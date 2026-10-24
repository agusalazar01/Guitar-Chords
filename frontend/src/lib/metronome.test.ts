import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beatsBetween, bpmFromBeats } from './metronome.ts'

test('metrónomo: pulso sugerido de la canción y golpes a programar', () => {
  const beats = Array.from({ length: 20 }, (_, i) => 1 + i * 0.6)
  assert.equal(bpmFromBeats(beats), 100)
  assert.equal(bpmFromBeats([1, 2]), null)
  const b = beatsBetween(beats, 2.0, 3.5, 0, 4) // golpes en 2.2, 2.8, 3.4
  assert.deepEqual(b.map((x) => [Math.round(x.t * 10) / 10, x.k]), [[2.2, 2], [2.8, 3], [3.4, 0]])
})
