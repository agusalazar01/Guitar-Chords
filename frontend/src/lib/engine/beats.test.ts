import test from 'node:test'
import assert from 'node:assert/strict'
import { beatPosition, estimateDownbeat, onsetEnvelope, trackBeats } from './beats.ts'
import { gauss, rng, synthSong } from './synth.ts'

test('tempo y pulsos de una banda sintética a 100 bpm', () => {
  const s = synthSong({ bpm: 100, bars: ['G', 'D', 'Em', 'C'], repeats: 3, seed: 1, noise: 0.08 })
  const { env, hopSec, offsetSec } = onsetEnvelope(s.samples, s.sr)
  const r = trackBeats(env, hopSec, offsetSec)
  assert.ok(r.bpm !== null && Math.abs(r.bpm - 100) < 2, `bpm ${r.bpm}`)
  const P = 0.6, off = r.beats.map((b) => Math.abs(((b % P) + P / 2) % P - P / 2)).sort((a, b) => a - b)
  assert.ok(off[Math.floor(off.length / 2)] < 0.06, 'los pulsos deben caer sobre la rejilla del tempo')
})
test('sin ritmo (tono estático) el pulso no es fiable', () => {
  const r = rng(5)
  const x = Float32Array.from({ length: 22050 * 10 }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 261 * i) / 22050) + 0.1 * gauss(r))
  const { env, hopSec, offsetSec } = onsetEnvelope(x, 22050)
  assert.ok(trackBeats(env, hopSec, offsetSec).strength < 0.25)
})
test('posición en el compás y pulso fuerte', () => {
  const beats = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  assert.deepEqual(beatPosition(beats, 2.5, 0, 4), { index: 2, inBar: 2, frac: 0.5, bar: 1 })
  assert.equal(beatPosition(beats, 4.1, 0, 4)?.inBar, 0)
  assert.equal(beatPosition(beats, 4.1, 0, 4)?.bar, 2)
  assert.equal(beatPosition(beats, 4.1, 1, 4)?.inBar, 3)
  assert.equal(beatPosition(beats, -1, 0, 4), null)
  assert.equal(estimateDownbeat([2, 6, 10, 14, 3], 4), 2)
})
