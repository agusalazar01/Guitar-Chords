import test from 'node:test'
import assert from 'node:assert/strict'
import { keyFromChords } from './key.ts'

const seg = (c: string, s: number, e: number) => ({ chord: c, start: s, end: e })

test('tonalidad por acordes: progresión en Mi menor (Am Em D G C)', () => {
  const k = keyFromChords([seg('Am', 0, 4), seg('Em', 4, 8), seg('D', 8, 15), seg('Am', 15, 19), seg('Em', 19, 23), seg('G', 23, 25), seg('C', 25, 27)])
  assert.ok(k && (k.name === 'E menor' || k.name === 'G mayor'), k?.name)
})
test('I vs IV casi empatados: gana la tonalidad correcta (sin recortar puntajes antes de comparar)', () => {
  // D# y G# casi igual de largos: debe ganar la tonalidad que empieza la canción
  const k = keyFromChords([seg('D#', 0, 9), seg('Fm', 9, 10), seg('G#', 10, 50), seg('D#', 50, 90), seg('A#', 90, 92)])
  assert.equal(k?.name, 'D# mayor')
})
test('sin acordes → null', () => { assert.equal(keyFromChords([seg('N', 0, 5)]), null) })
