import test from 'node:test'
import assert from 'node:assert/strict'
import { alignCifrado, cifradoSegments, normalizeChord, parseCifrado } from './cifrado.ts'
import { addAnchor } from './lyrics.ts'

test('normalizeChord: inglés, latino, bemoles y calidades', () => {
  assert.equal(normalizeChord('Am'), 'Am')
  assert.equal(normalizeChord('Bb7'), 'A#7')
  assert.equal(normalizeChord('Solm'), 'Gm')
  assert.equal(normalizeChord('Fa#m7'), 'F#m7')
  assert.equal(normalizeChord('C7M'), 'Cmaj7')
  assert.equal(normalizeChord('G/B'), 'G/B')
  assert.equal(normalizeChord('Dsus4'), 'Dsus4')
  assert.equal(normalizeChord('E9'), 'E7')
  assert.equal(normalizeChord('casa'), null)
  assert.equal(normalizeChord('La'), 'A') // en un cancionero en español «La» sola en una línea de acordes es La mayor
})

const CIF = `Intro: Am  G  F  E

Am          G
Esta es la primera línea
F                 E
y esta es la segunda línea

[Estribillo]
C        G
canto el estribillo acá
Am       E
y lo repito otra vez`

test('parseCifrado: acordes sobre la letra, intro instrumental y títulos', () => {
  const p = parseCifrado(CIF)
  assert.deepEqual(p[0].chords.map((c) => c.chord), ['Am', 'G', 'F', 'E'])
  assert.equal(p[0].text, '')
  const l1 = p.find((x) => x.text.startsWith('Esta es'))!
  assert.deepEqual(l1.chords.map((c) => [c.pos, c.chord]), [[0, 'Am'], [12, 'G']])
})

test('alignCifrado: ubica acordes con la letra, intro antes del canto y estribillo repetido', () => {
  const lrc = [
    { t: 10, text: 'Esta es la primera línea' }, { t: 14, text: 'y esta es la segunda línea' },
    { t: 18, text: 'canto el estribillo acá' }, { t: 22, text: 'y lo repito otra vez' },
    { t: 30, text: 'canto el estribillo acá' }, // repetido: el cifrado lo escribe una sola vez
  ]
  const ev = alignCifrado(parseCifrado(CIF), lrc)
  const at = (t: number) => [...ev].reverse().find((e) => e.l <= t)?.chord
  assert.equal(at(9.9), 'E') // intro termina en E justo antes del canto
  assert.equal(at(10.2), 'Am')
  assert.equal(at(13.5), 'G')
  assert.equal(at(18.2), 'C')
  assert.equal(at(30.2), 'C') // estribillo repetido encontrado por parecido
  assert.ok(ev[0].l >= 0 && ev[0].l < 10)
  // con «Empezó a cantar» 5 s más tarde, todos los acordes se corren
  const seg = cifradoSegments(ev, 60, addAnchor([], 10, 15))
  const am = seg.find((s) => s.chord === 'Am' && s.start > 12)!
  assert.ok(Math.abs(am.start - 15) < 0.05)
})
