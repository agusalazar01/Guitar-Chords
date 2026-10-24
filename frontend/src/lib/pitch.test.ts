import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectPitch, noteOf } from './pitch.ts'

/** Tono de guitarra sintético: fundamental + armónicos que decaen (la cuerda real tiene armónicos fuertes). */
function pluck(f: number, sr = 44100, n = 4096) {
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) { const t = i / sr; b[i] = 0.4 * Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) + 0.2 * Math.sin(6 * Math.PI * f * t) + 0.1 * Math.sin(8 * Math.PI * f * t) }
  return b
}

test('afinador: detecta las cuerdas de la guitarra (con armónicos) con menos de 2 cents de error', () => {
  for (const f of [82.41, 110, 146.83, 196, 246.94, 329.63, 97.5]) {
    const got = detectPitch(pluck(f), 44100)
    assert.ok(got !== null, `no detectó ${f}`)
    assert.ok(Math.abs(1200 * Math.log2(got! / f)) < 2, `${f} → ${got}`)
  }
  assert.equal(detectPitch(new Float32Array(4096), 44100), null) // silencio
})

test('afinador: nota en cifrado americano y desvío en cents, con La de referencia ajustable', () => {
  assert.deepEqual({ ...noteOf(440), cents: Math.round(noteOf(440).cents) }, { name: 'A', octave: 4, midi: 69, cents: 0, target: 440 })
  const e = noteOf(80)
  assert.equal(e.name, 'D#'); assert.ok(e.cents > 40) // 80 Hz: casi E2, entre D#2 y E2
  assert.equal(noteOf(82.41).name, 'E')
  assert.ok(Math.round(noteOf(440, 432).cents) === 32) // con La = 432 Hz, 440 Hz suena 32 cents alto
  assert.ok(noteOf(108).cents < 0) // La grave un poco bajo: hay que tensar
})
