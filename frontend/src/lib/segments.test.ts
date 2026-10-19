import test from 'node:test'
import assert from 'node:assert/strict'
import { markChordAt, moveEnd, moveStart, removeAt, setChordAt, splitAt } from './segments.ts'
import type { Segment } from './types.ts'

const mk = (): Segment[] => [
  { start: 0, end: 4, chord: 'C', confidence: 0.9 },
  { start: 4, end: 8, chord: 'G', confidence: 0.8 },
  { start: 8, end: 12, chord: 'Am', confidence: 0.7 },
]
const contiguous = (s: Segment[]) => s.every((x, i) => x.end > x.start && (i === 0 || x.start === s[i - 1].end))

test('setChordAt no muta y borra la confianza', () => {
  const a = mk(), b = setChordAt(a, 1, 'F')
  assert.equal(a[1].chord, 'G'); assert.equal(b[1].chord, 'F'); assert.equal(b[1].confidence, null)
})
test('moveStart mantiene contigüidad y respeta mínimos', () => {
  let s = moveStart(mk(), 1, 5.5)
  assert.equal(s[0].end, 5.5); assert.equal(s[1].start, 5.5); assert.ok(contiguous(s))
  s = moveStart(mk(), 1, 100); assert.equal(s[1].start, 7.9); assert.ok(contiguous(s))
  s = moveStart(mk(), 1, -5); assert.equal(s[1].start, 0.1); assert.ok(contiguous(s))
  s = moveStart(mk(), 0, -3); assert.equal(s[0].start, 0)
})
test('moveEnd', () => {
  let s = moveEnd(mk(), 0, 3); assert.equal(s[1].start, 3); assert.ok(contiguous(s))
  s = moveEnd(mk(), 2, 20); assert.equal(s[2].end, 20)
  s = moveEnd(mk(), 2, 1); assert.equal(s[2].end, 8.1)
})
test('splitAt y removeAt', () => {
  let s = splitAt(mk(), 1, 6); assert.equal(s.length, 4); assert.ok(contiguous(s)); assert.deepEqual(s.map((x) => x.chord), ['C', 'G', 'G', 'Am'])
  assert.equal(splitAt(mk(), 1, 4.05).length, 3)
  s = removeAt(mk(), 1); assert.equal(s.length, 2); assert.equal(s[0].end, 8); assert.ok(contiguous(s))
  s = removeAt(mk(), 0); assert.equal(s[0].start, 0); assert.ok(contiguous(s))
  assert.equal(removeAt([mk()[0]], 0).length, 1)
})

test('markChordAt: N antes del primer acorde, se extiende hasta el final', () => {
  const a = markChordAt([], 2, 'G', 100)
  assert.deepEqual(a.map((s) => [s.start, s.end, s.chord]), [[0, 2, 'N'], [2, 100, 'G']])
  const b = markChordAt(a, 6.5, 'D', 100)
  assert.deepEqual(b.map((s) => [s.start, s.end, s.chord]), [[0, 2, 'N'], [2, 6.5, 'G'], [6.5, 100, 'D']])
})

test('markChordAt: tocar en el mismo instante reemplaza; repetir el mismo acorde no cambia nada', () => {
  const a = markChordAt(markChordAt([], 0, 'C', 50), 10, 'F', 50)
  assert.deepEqual(markChordAt(a, 10.05, 'G', 50).map((s) => s.chord), ['C', 'G'])
  assert.equal(markChordAt(a, 20, 'F', 50), a)
})
