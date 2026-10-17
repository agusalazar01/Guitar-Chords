import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeSamples } from './analyze.ts'

const SR = 22050
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()) }

function tone(pcs: number[], secs: number, r: () => number, cents = 0): Float32Array {
  const n = Math.floor(SR * secs), y = new Float32Array(n)
  for (const pc of pcs) {
    const f0 = 261.63 * 2 ** ((pc + cents / 100) / 12)
    for (const [h, a] of [[1, 1], [2, 0.5], [3, 0.3]]) for (let i = 0; i < n; i++) y[i] += a * Math.sin((2 * Math.PI * f0 * h * i) / SR)
  }
  for (let i = 0; i < n; i++) y[i] += 0.15 * gauss(r)
  return y
}
const concat = (parts: Float32Array[]) => { const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length } return out }
const sil = (secs: number, r: () => number) => Float32Array.from({ length: Math.floor(SR * secs) }, () => 0.001 * gauss(r))

test('detecta C → Am → silencio → G con ruido, sin parpadeos', () => {
  const r = rng(1)
  const y = concat([tone([0, 4, 7], 3, r), tone([9, 0, 4], 3, r), sil(1, r), tone([7, 11, 2], 3, r)])
  const out = analyzeSamples(y, SR)
  const seq = out.segments.map((s) => s.chord)
  assert.deepEqual(seq, ['C', 'Am', 'N', 'G'], JSON.stringify(out.segments))
  assert.ok(Math.abs(out.segments[1].start - 3) < 0.35 && Math.abs(out.segments[3].start - 7) < 0.35)
  assert.ok(out.segments.every((s, i, a) => s.end > s.start && (i === 0 || s.start === a[i - 1].end)))
})

test('robusto a desafinación de +30 centésimas', () => {
  const r = rng(2)
  const out = analyzeSamples(concat([tone([0, 4, 7], 3, r, 30), tone([5, 9, 0], 3, r, 30)]), SR)
  assert.deepEqual(out.segments.map((s) => s.chord), ['C', 'F'], JSON.stringify(out.segments))
})

test('audio demasiado corto → error claro', () => {
  assert.throws(() => analyzeSamples(new Float32Array(100), SR), /demasiado corto/)
})
