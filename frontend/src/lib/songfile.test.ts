import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeSongs, encodeSongs, songsToAdd } from './songfile.ts'
import { chordSequence } from './cifrado.ts'
import type { Song } from './songs.ts'

const S = (id: string, audio: Blob | null): Song => ({ id, filename: `Canción ${id}`, createdAt: 1, duration: 10, method: 'm', lowConfidence: false,
  original: [{ start: 0, end: 2, chord: 'Am', confidence: null }], corrections: null, settings: { videoId: 'abcdefghijk', transpose: 0, offset: 0 }, audio, order: 0 })

test('archivo de Mi Cancionero: ida y vuelta con y sin audio', async () => {
  const a = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'audio/mpeg' })
  const f = encodeSongs([S('1', a), S('2', null), S('3', new Blob([new Uint8Array([9, 9])], { type: 'audio/wav' }))], true)
  const back = await decodeSongs(f)
  assert.equal(back.length, 3)
  assert.deepEqual([...new Uint8Array(await back[0].audio!.arrayBuffer())], [1, 2, 3, 4, 5])
  assert.equal(back[1].audio, null)
  assert.deepEqual([...new Uint8Array(await back[2].audio!.arrayBuffer())], [9, 9])
  assert.equal(back[2].audio!.type, 'audio/wav')
  assert.deepEqual(back[0].original, S('1', null).original)
  const shared = await decodeSongs(encodeSongs([S('1', a)], false))
  assert.equal(shared[0].audio, null)
  await assert.rejects(decodeSongs(new Blob(['hola'])), /no es de Mi Cancionero/)
})

test('importar: compartida entra como nueva; copia de seguridad saltea las que ya están', () => {
  const have = [S('1', null)]
  let n = 0
  const sh = songsToAdd(have, [S('1', null)], 'share', () => `n${++n}`)
  assert.equal(sh[0].id, 'n1')
  assert.equal(songsToAdd(have, [S('1', null), S('2', null)], 'restore', () => 'x').map((s) => s.id).join(), '2')
})

test('secuencia de acordes para el modo «Siguiente»', () => {
  assert.deepEqual(chordSequence('Am F C G'), ['Am', 'F', 'C', 'G'])
  assert.deepEqual(chordSequence('Intro: Am | F | Do | Sol x2'), ['Am', 'F', 'C', 'G'])
})
