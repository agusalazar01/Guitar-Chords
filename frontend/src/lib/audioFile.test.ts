import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_BYTES, validateAudioFile } from './audioFile.ts'

const b = (...x: number[]) => Uint8Array.from(x)
test('acepta MP3/WAV con cabecera real', () => {
  assert.equal(validateAudioFile('a.MP3', 10, b(0x49, 0x44, 0x33, 3)), '.mp3')
  assert.equal(validateAudioFile('a.mp3', 10, b(0xff, 0xfb, 0x90)), '.mp3')
  assert.equal(validateAudioFile('a.wav', 10, b(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)), '.wav')
})
test('rechaza extensión, tamaño y contenido inválidos', () => {
  assert.throws(() => validateAudioFile('a.exe', 10, b(0xff, 0xfb)), /Formato/)
  assert.throws(() => validateAudioFile('a.mp3', 0, b(0xff, 0xfb)), /vacío/)
  assert.throws(() => validateAudioFile('a.mp3', MAX_BYTES + 1, b(0xff, 0xfb)), /máximo/)
  assert.throws(() => validateAudioFile('a.mp3', 10, b(0x4d, 0x5a, 0, 0)), /contenido/)
  assert.throws(() => validateAudioFile('a.wav', 10, b(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20)), /contenido/)
})
