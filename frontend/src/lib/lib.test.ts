import test from 'node:test'
import assert from 'node:assert/strict'
import { findActiveIndex, loopTarget, transposeChord, transposeSegments } from './chords.ts'
import { formatTime, parseYouTubeId } from './youtube.ts'
import type { Segment } from './types.ts'

const segs: Segment[] = [
  { start: 0, end: 4, chord: 'C', confidence: null },
  { start: 4, end: 8, chord: 'G', confidence: null },
  { start: 10, end: 12, chord: 'Am', confidence: null },
]

test('findActiveIndex: tiempo → acorde activo, saltos y huecos', () => {
  assert.equal(findActiveIndex(segs, 0), 0)
  assert.equal(findActiveIndex(segs, 3.99), 0)
  assert.equal(findActiveIndex(segs, 4), 1)
  assert.equal(findActiveIndex(segs, 9), -1)
  assert.equal(findActiveIndex(segs, 11), 2)
  assert.equal(findActiveIndex(segs, 12), -1)
  assert.equal(findActiveIndex(segs, 100), -1)
  assert.equal(findActiveIndex([], 1), -1)
})

test('saltos: el índice depende solo del tiempo', () => {
  assert.equal(findActiveIndex(segs, 11), 2)
  assert.equal(findActiveIndex(segs, 1), 0)
  assert.equal(findActiveIndex(segs, 5), 1)
})

test('desfase: tiempo_video = inicio + offset', () => {
  assert.equal(findActiveIndex(segs, 2.5, 2), 0)
  assert.equal(findActiveIndex(segs, 6.2, 2), 1)
  assert.equal(findActiveIndex(segs, 1, 2), -1)
  assert.equal(findActiveIndex(segs, 1, -2), 0)
})

test('transposición', () => {
  assert.equal(transposeChord('C', 2), 'D')
  assert.equal(transposeChord('Am', 3), 'Cm')
  assert.equal(transposeChord('E7', 1), 'F7')
  assert.equal(transposeChord('Bb', 2), 'C')
  assert.equal(transposeChord('B', 1), 'C')
  assert.equal(transposeChord('C', -1), 'B')
  assert.equal(transposeChord('N', 5), 'N')
  assert.equal(transposeSegments(segs, 0), segs)
  assert.deepEqual(transposeSegments(segs, 2).map((s) => s.chord), ['D', 'A', 'Bm'])
})

test('bucle', () => {
  assert.equal(loopTarget(5, null), null)
  assert.equal(loopTarget(5, { start: 2, end: 6 }), null)
  assert.equal(loopTarget(6, { start: 2, end: 6 }), 2)
  assert.equal(loopTarget(6, { start: 6, end: 6 }), null)
})

test('enlaces de YouTube', () => {
  const id = 'dQw4w9WgXcQ'
  for (const u of [id, `https://www.youtube.com/watch?v=${id}&t=5`, `https://youtu.be/${id}`, `youtube.com/shorts/${id}`, `https://m.youtube.com/embed/${id}`])
    assert.equal(parseYouTubeId(u), id, u)
  for (const u of ['', 'hola', `https://evil.com/watch?v=${id}`, 'https://youtu.be/corto', `https://youtube.com/watch?v=${id}x`])
    assert.equal(parseYouTubeId(u), null, u)
})

test('formatTime', () => {
  assert.equal(formatTime(65.9), '1:05')
  assert.equal(formatTime(NaN), '0:00')
})
