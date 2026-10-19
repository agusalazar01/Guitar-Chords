import test from 'node:test'
import assert from 'node:assert/strict'
import { NOTES, TUNING, chordTones, getDiagrams, normalize } from './chordLibrary.ts'
import { transposeChord } from './chords.ts'

const QUALS = ['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', 'dim', 'aug', '6', '9', 'add9']
const ALL = NOTES.flatMap((r) => QUALS.map((q) => r + q))

test('cada diagrama de cada acorde: solo notas del acorde, las obligatorias presentes, raíz en el bajo y tocable', () => {
  for (const name of ALL) {
    const [root] = normalize(name)!
    const tones = chordTones(name)!, r = NOTES.indexOf(root), fifth = (r + 7) % 12
    const required = tones.size >= 4 ? new Set([...tones].filter((t) => t !== fifth)) : tones // la 5ª se puede omitir en acordes de 4+ notas
    for (const d of getDiagrams(name)) {
      const sounded = d.frets.map((f, i) => (f >= 0 ? (TUNING[i] + f) % 12 : -1)).filter((x) => x >= 0)
      const tag = `${name} ${d.label} ${d.frets.join(',')}`
      assert.ok(sounded.every((p) => tones.has(p)), `${tag}: nota ajena`)
      assert.ok([...required].every((p) => sounded.includes(p)), `${tag}: falta una nota`)
      assert.equal(sounded[0], r, `${tag}: el bajo no es la raíz`)
      const fretted = d.frets.filter((f) => f > 0)
      assert.ok(!fretted.length || Math.max(...fretted) - Math.min(...fretted) <= 3, `${tag}: abarca más de 4 trastes`)
      assert.ok(d.frets.every((f, i) => f <= 0 || d.fingers[i] > 0 || (d.barre && f === d.barre.fret && i >= d.barre.from_string && i <= d.barre.to_string)), `${tag}: nota pisada sin dedo`)
    }
  }
})

test('cobertura: todos los mayores, menores, séptimas, maj7, m7, sus, dim, aug, 6 y 9 tienen al menos una posición', () => {
  const missing = NOTES.flatMap((r) => QUALS.filter((q) => q !== 'add9').map((q) => r + q)).filter((n) => !getDiagrams(n).length)
  assert.deepEqual(missing, [])
})

test('inversiones: G/B usa la forma de G; transponer mueve también el bajo', () => {
  assert.ok(getDiagrams('G/B').length && getDiagrams('G/B')[0].chord === 'G')
  assert.equal(transposeChord('G/B', 2), 'A/C#')
  assert.equal(transposeChord('Bb/D', 2), 'C/E')
  assert.equal(transposeChord('Am7', 1), 'A#m7')
  assert.equal(transposeChord('N', 3), 'N')
})

test('transponer cambia nombre Y diagrama de forma consistente', () => {
  for (const base of ['C', 'Am', 'E7', 'G', 'Dmaj7', 'Bm7']) for (let s = -11; s <= 11; s++) {
    const name = transposeChord(base, s), ds = getDiagrams(name)
    assert.ok(ds.length, name)
    assert.ok(ds.every((d) => d.chord === normalize(name)!.join('')), name)
  }
})

test('sin posición verificada → lista vacía; bemoles normalizados', () => {
  assert.deepEqual(getDiagrams('Cmaj9'), []); assert.deepEqual(getDiagrams('H'), [])
  assert.equal(getDiagrams('Bb')[0].chord, 'A#')
})
