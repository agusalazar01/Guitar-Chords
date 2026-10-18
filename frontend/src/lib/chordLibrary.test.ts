import test from 'node:test'
import assert from 'node:assert/strict'
import { NOTES, TUNING, chordTones, getDiagrams, normalize } from './chordLibrary.ts'
import { transposeChord } from './chords.ts'

const EXTRA = ['C7', 'D7', 'E7', 'G7', 'A7', 'B7', 'Cmaj7', 'Dmaj7', 'Emaj7', 'Fmaj7', 'Gmaj7', 'Amaj7', 'Am7', 'Dm7', 'Em7', 'Bm7', 'Asus2', 'Asus4', 'Dsus2', 'Dsus4', 'Esus4', 'Bdim', 'Caug']
const ALL = [...NOTES.flatMap((r) => [r, r + 'm']), ...EXTRA]

test('cada diagrama: solo notas del acorde, notas obligatorias y raíz en el bajo', () => {
  for (const name of ALL) {
    const ds = getDiagrams(name)
    assert.ok(ds.length, name)
    const [root] = normalize(name)!
    const tones = chordTones(name)!, fifth = (NOTES.indexOf(root) + 7) % 12
    const required = tones.size === 4 ? new Set([...tones].filter((t) => t !== fifth)) : tones
    for (const d of ds) {
      const sounded = d.frets.map((f, i) => (f >= 0 ? (TUNING[i] + f) % 12 : -1)).filter((x) => x >= 0)
      assert.ok(sounded.every((p) => tones.has(p)), `${name} ${d.label}: nota ajena`)
      assert.ok([...required].every((p) => sounded.includes(p)), `${name} ${d.label}: falta una nota`)
      assert.equal(sounded[0], NOTES.indexOf(root), `${name} ${d.label}: bajo`)
      assert.equal(d.frets.length, 6); assert.equal(d.fingers.length, 6)
    }
  }
})

test('transponer cambia nombre Y diagrama de forma consistente', () => {
  for (const base of ['C', 'Am', 'E7', 'G']) for (let s = -11; s <= 11; s++) {
    const name = transposeChord(base, s)
    const ds = getDiagrams(name)
    const isTriad = !/7/.test(name)
    if (isTriad) assert.ok(ds.length, name) // mayores y menores: siempre hay posición
    assert.ok(ds.every((d) => d.chord === normalize(name)!.join('')), name) // si hay diagrama, es del acorde transpuesto
  }
})

test('sin posición verificada → lista vacía; bemoles normalizados', () => {
  assert.deepEqual(getDiagrams('Cmaj9'), []); assert.deepEqual(getDiagrams('H'), []); assert.deepEqual(getDiagrams('F#maj7'), []) // sin posición verificada
  assert.equal(getDiagrams('Bb')[0].chord, 'A#')
})
