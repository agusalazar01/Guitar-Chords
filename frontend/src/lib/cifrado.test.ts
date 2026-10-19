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

test('alignCifrado: líneas cortadas distinto en el cifrado y en la letra no pierden acordes (Coti, «Nada fue un error»)', () => {
  const cif = `   A
Los errores no se eligen
   E/G#
Para bien o para mal
   D/F#
No fallé cuando viniste
       E
Y tú, y tú

No quisiste fallar

    A
Aprendí la diferencia
     E/G#
Entre juego y el azar

[Estribillo]
E                    A
Nada de esto fue un error
  E
Uh-Oh-Oh
 D
Nada fue un error`
  const lrc = [['Los errores no se eligen', 56], ['Para bien o para mal', 60], ['No fallé cuando viniste', 63], ['Y tú, y tú no quisiste fallar', 66],
    ['Aprendí la diferencia', 70], ['Entre el juego y el azar', 73], ['Nada de esto fue un error, uoh-oh', 77], ['Nada fue un error', 81]].map(([text, t]) => ({ text: text as string, t: t as number }))
  const ev = alignCifrado(parseCifrado(cif), lrc)
  assert.deepEqual(ev.map((e) => e.chord), ['A', 'E/G#', 'D/F#', 'E', 'A', 'E/G#', 'E', 'A', 'E', 'D'])
  const e = ev.find((x) => x.chord === 'E')!
  assert.ok(e.l >= 66 && e.l < 68, `E en ${e.l}`) // «Y tú, y tú» al comienzo de la línea unida
  const uh = ev.filter((x) => x.chord === 'E')[2]
  assert.ok(uh.l > 78 && uh.l < 81, `E de «uoh-oh» en ${uh.l}`)
})
