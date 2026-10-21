import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readId3 } from './id3.ts'

const frame = (id: string, s: string) => { const b = new TextEncoder().encode(s); const f = new Uint8Array(10 + 1 + b.length); f.set([...id].map((c) => c.charCodeAt(0)), 0); const n = b.length + 1; f.set([n >> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255], 4); f[10] = 3; f.set(b, 11); return f }

test('MP3: lee artista y título de las etiquetas ID3 (v2.3 y v1)', () => {
  const fr = [frame('TIT2', 'Carta para no llorar'), frame('TPE1', 'El Kuelgue')]
  const size = fr.reduce((a, f) => a + f.length, 0)
  const head = new Uint8Array(10 + size + 20)
  head.set([0x49, 0x44, 0x33, 3, 0, 0, (size >> 21) & 127, (size >> 14) & 127, (size >> 7) & 127, size & 127])
  let p = 10; for (const f of fr) { head.set(f, p); p += f.length }
  assert.deepEqual(readId3(head), { title: 'Carta para no llorar', artist: 'El Kuelgue' })
  const tail = new Uint8Array(128); tail.set([0x54, 0x41, 0x47]); tail.set(new TextEncoder().encode('Zafar'), 3); tail.set(new TextEncoder().encode('La Vela Puerca'), 33)
  assert.deepEqual(readId3(new Uint8Array(20), tail), { title: 'Zafar', artist: 'La Vela Puerca' })
  assert.deepEqual(readId3(new Uint8Array(20)), {})
})
