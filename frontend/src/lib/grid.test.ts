import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateBeats, simplifyChord } from './grid.ts'

test('simplifyChord', () => {
  assert.equal(simplifyChord('Gmaj7'), 'G')
  assert.equal(simplifyChord('Am7'), 'Am')
  assert.equal(simplifyChord('E7/G#'), 'E')
  assert.equal(simplifyChord('Dsus4'), 'D')
  assert.equal(simplifyChord('Bdim'), 'Bdim')
  assert.equal(simplifyChord('N'), 'N')
})

test('estimateBeats: cambios cada 2 y 4 pulsos de 0,5 s', () => {
  const t = [1, 2, 4, 5, 6, 8, 9, 11, 13]
  const segs = t.map((s, i) => ({ start: s, end: t[i + 1] ?? s + 2, chord: i % 2 ? 'G' : 'C', confidence: null }))
  const b = estimateBeats(segs, 20)
  assert.ok(b.length > 10)
  const p = b[1] - b[0]
  assert.ok(Math.abs(p - 1) < 0.02 || Math.abs(p - 0.5) < 0.02, `período ${p}`)
  assert.equal(b[0], 1)
})
