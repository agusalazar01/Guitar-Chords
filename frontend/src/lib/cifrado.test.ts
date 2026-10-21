import test from 'node:test'
import assert from 'node:assert/strict'
import { alignCifrado, cifradoLyrics, cifradoMeta, cifradoSegments, lyricsFromChords, isTabLine, compressToSung, gridFromBars, METERS, midBeat, MIN_CHORD_GAP, placeOnBeats, normalizeChord, parseCifrado, uncoveredParts, upgradeCifrado } from './cifrado.ts'
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

test('alignCifrado: ningún acorde se pierde aunque el último de una línea caiga pegado al primero de la siguiente', () => {
  const txt = [
    'Am                        Dm           G', ' Soy de la ciudad con todo lo que ves',
    'Am                           Dm            G', 'con su ruido, con su gente, consume vejez.',
    '  Am                    Dm                 G', 'Y no puedo evitar, el humo que entra hoy',
  ].join('\n')
  const lrc = [' Soy de la ciudad con todo lo que ves', 'con su ruido, con su gente, consume vejez.', 'Y no puedo evitar, el humo que entra hoy'].map((text, i) => ({ t: 23 + i * 5, text }))
  const ev = alignCifrado(parseCifrado(txt), lrc)
  assert.deepEqual(ev.map((e) => e.chord), ['Am', 'Dm', 'G', 'Am', 'Dm', 'G', 'Am', 'Dm', 'G'])
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].l - ev[i - 1].l >= MIN_CHORD_GAP - 1e-9, `separación en ${i}`)
})

test('parseCifrado: acordes con punto («Am.») y tablaturas ignoradas', () => {
  const txt = ['[Tab - Intro]', '    Am      Dm', 'E|-----0-----0-----0---|', 'B|-----1-----1-----1---|', 'Am.                  Dm.', 'Y no puedo evitar, el humo que entra', '            G', ' hoy'].join('\n')
  const cif = parseCifrado(txt)
  assert.deepEqual(cif.flatMap((l) => l.chords.map((c) => c.chord)), ['Am', 'Dm', 'Am', 'Dm', 'G'])
  assert.ok(!cif.some((l) => l.text.includes('|---')), 'la tablatura no queda como letra')
})

test('alignCifrado: una estrofa que se repite más adelante se une a su primera aparición', () => {
  const verse = ['Soy de la ciudad con todo lo que ves', 'con su ruido, con su gente, consume vejez']
  const txt = verse.flatMap((t) => ['Am            Dm        G', t]).join('\n')
  const lrc = [...verse, 'Me voy volando por ahi', 'y estoy convencido de ir', ...verse].map((text, i) => ({ t: 20 + i * 5, text }))
  const ev = alignCifrado(parseCifrado(txt), lrc)
  assert.equal(ev[0].chord, 'Am')
  assert.ok(ev[0].l < 21 && ev.filter((e) => e.l < 30).length >= 6, `primera estrofa con sus acordes: ${ev.map((e) => e.l.toFixed(1) + e.chord).join(' ')}`)
})

test('upgradeCifrado: una canción guardada con acordes «Am.» leídos como letra se recupera', () => {
  const viejo = [{ text: 'Am.                  Dm.', chords: [] }, { text: 'Y no puedo evitar, el humo', chords: [] }]
  const nuevo = upgradeCifrado(viejo)
  assert.ok(nuevo)
  assert.deepEqual(nuevo!.flatMap((l) => l.chords.map((c) => c.chord)), ['Am', 'Dm'])
  assert.equal(upgradeCifrado(nuevo!), null)
})

test('cifradoMeta: tono y cejilla de la página; esas líneas no se leen como acordes', () => {
  const txt = 'Tono: Re menor\nCapo en el 2º traste\n\nAm        Dm\nSoy de la ciudad'
  assert.deepEqual(cifradoMeta(txt), { key: 'Dm', capo: 2 })
  assert.deepEqual(cifradoMeta('Tom: G\nCapotraste na 3ª casa'), { key: 'G', capo: 3 })
  assert.deepEqual(parseCifrado(txt).flatMap((l) => l.chords.map((c) => c.chord)), ['A', 'D'].map((x) => x + 'm'))
  assert.deepEqual(cifradoMeta('Key to my heart\nAm Dm'), {})
})

test('Notación latina en mayúsculas (LaCuerda): «RE», «SOL5», «LA4», «MIm», «Solº», marcas «A)» y tablatura con cuerdas latinas', () => {
  const txt = ["   MI |-----2---2------3---|", "  sol|---2---2-----4----4-|", '   A)RE', '   Niño, mi niño,', '       SOL5       LA4', '   vendrás en primavera,', '          RE, Solº, RE, Solº', '   te traeré', '   B)mim              LA7', '   Y aunque nazcas pobre,'].join('\n')
  assert.deepEqual(parseCifrado(txt).flatMap((l) => l.chords.map((c) => c.chord)), ['D', 'G', 'Asus4', 'D', 'Gdim', 'D', 'Gdim', 'Em', 'A7'])
  assert.equal(normalizeChord('la'), null) // palabra de la letra
})

test('cifradoLyrics: letra sin acordes, uniendo las líneas cortadas por el ancho del celular', () => {
  const lines = parseCifrado(['Tono: A', '                   E7', '   Yo se que en el pago me tienen', '         A', 'idea', '  porque a los que mandan no les', '[Estribillo]', 'Me voy, volando.'].join('\n'))
  assert.equal(cifradoLyrics(lines), 'Yo se que en el pago me tienen idea\nporque a los que mandan no les\nMe voy, volando.')
})

test('lyricsFromChords: cada línea aparece cuando suena su primer acorde; las líneas sin acordes se reparten', () => {
  const lines = parseCifrado(['Tono: Am', 'Am            Dm', 'Soy de la ciudad', 'con todo lo que ves', 'G         Am', 'con su ruido'].join('\n'))
  const ly = lyricsFromChords(lines, [10, 12, 18, 20])
  assert.deepEqual(ly.map((l) => l.text), ['Soy de la ciudad', 'con todo lo que ves', 'con su ruido'])
  assert.equal(ly[0].t, 9.8)
  assert.ok(ly[1].t > ly[0].t && ly[1].t < ly[2].t)
  assert.equal(ly[2].t, 17.8)
})

test('uncoveredParts: avisa las estrofas de la letra que quedaron sin ningún acorde', () => {
  const lrc = [{ t: 10, text: 'uno' }, { t: 13, text: 'dos' }, { t: 16, text: '' }, { t: 25, text: 'Tengo algo mal pensado' }, { t: 28, text: 'otra' }]
  assert.deepEqual(uncoveredParts([{ l: 10, chord: 'G' }, { l: 13.5, chord: 'D' }], lrc), ['Tengo algo mal pensado'])
  assert.deepEqual(uncoveredParts([{ l: 10, chord: 'G' }, { l: 25, chord: 'D' }], lrc), [])
})

test('Cifrados de LaCuerda: acordes con guiones, extensiones «7/9», etiquetas sin «:» y tablaturas con prefijo o sin barra', () => {
  const ch = (t: string) => parseCifrado(t).flatMap((l) => l.chords.map((c) => c.chord))
  assert.deepEqual(ch('Bm-G-D-A       Bm-G-D-A\nDe aquel amor, de música ligera'), ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A'])
  assert.deepEqual(ch('Bm      G      D         A         (Bm-G-D-A)\nElla durmio'), ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A'])
  assert.deepEqual(ch('F#7/9        Bm\nY el arriero va'), ['F#7', 'Bm'])
  assert.deepEqual(ch('INTRO Bm Em7 A D F#   x 2'), ['Bm', 'Em7', 'A', 'D', 'F#'])
  assert.deepEqual(ch('FA#m RE LA        Tablatura Abajo'), ['F#m', 'D', 'A'])
  assert.equal(ch('LA calle Durazno').length, 0) // letra en mayúsculas, no acordes
  for (const t of ['    1)  G|--4---2---0----------------0------0-------0---0-|', 'e-0-0-2-2-3-3-5-5-7-7-8-10-8-10---17--17', 'B-3-(8 veces)-1-0--------------------3---------3--3/5-3---'])
    assert.ok(isTabLine(t), t)
  assert.ok(!isTabLine('Me voy, volando por ahí'))
})

test('Notaciones propias de algunos cancioneros: se toma el acorde del comienzo', () => {
  assert.deepEqual(['B7.9', 'F7.13', 'E(s3)6', 'C#7[4-', 'F#m7*', 'Bb*', 'B4.7/F#'].map(normalizeChord), ['B7', 'F7', 'E', 'C#7', 'F#m7', 'A#', 'Bsus4'])
  assert.deepEqual(parseCifrado('C#7[4-    3]       F#m7*\n  No te enamores de nadie').flatMap((l) => l.chords.map((c) => c.chord)), ['C#7', 'F#m7'])
  assert.equal(normalizeChord('Brilla'), null)
  assert.equal(normalizeChord('Amor.'), null)
})

test('fillSections: una estrofa repetida en dos mitades copia cada mitad de la estrofa modelo, y fill:false deja solo lo de la página', () => {
  const v1 = ['No lo vieron a Molina', 'Que no pisa más el bar', 'Dónde está la Gran Muñeca', 'Que no trilla el bulevar', 'Esta noche es de recuerdos', 'Este brindis por Pierrot', 'Volverás Mario Benítez', 'Con tu Línea Maginot']
  const ch = ['Bm', 'F#m7', 'Em7', 'D7', 'C#7', 'Bm7', 'C#7', 'C#dim']
  const txt = v1.flatMap((t, i) => [ch[i], t]).join('\n') + '\n\nNo se acuerdan de la Bruta\nCon Pianito en su lugar\nNo me olvido más del Ñato\nImitando a Dogomar\nEsta noche es de recuerdos\nEste brindis por La Unión\nAhí estás Martíncorena\nEscuchando esta canción'
  const v3 = ['No se acuerdan de la Bruta', 'Con Pianito en su lugar', 'No me olvido más del Ñato', 'Imitando a Dogomar', 'Esta noche es de recuerdos', 'Este brindis por La Unión', 'Ahí estás Martíncorena', 'Escuchando esta canción']
  const lrc = [...v1.map((text, i) => ({ t: 10 + i * 3, text })), { t: 35, text: '' }, ...v3.map((text, i) => ({ t: 40 + i * 3, text }))]
  const at = (ev: { l: number; chord: string }[], t: number) => ev.filter((e) => e.l <= t + 0.3).at(-1)?.chord
  const ev = alignCifrado(parseCifrado(txt), lrc)
  assert.deepEqual([40, 43, 46, 49, 52].map((t) => at(ev, t)), ['Bm', 'F#m7', 'Em7', 'D7', 'C#7'])
  const raw = alignCifrado(parseCifrado(txt), lrc, { fill: false })
  assert.ok(raw.length < ev.length)
})

test('compressToSung: un acorde de mitad de línea seguido de una pausa se ubica en la parte cantada; el del comienzo no se mueve', () => {
  const sung = [
    { t: 10, text: 'una linea cantada de corrido' }, { t: 13, text: 'otra linea cantada seguida' },
    { t: 16, text: 'esta tiene una pausa larga' }, { t: 24, text: 'y vuelve el canto normal' }, { t: 27, text: 'final' },
  ]
  const ev = [{ l: 10, chord: 'C' }, { l: 16, chord: 'G' }, { l: 20, chord: 'Am' }, { l: 24, chord: 'F' }]
  const out = compressToSung(ev, sung)
  assert.equal(out[0].l, 10); assert.equal(out[1].l, 16); assert.equal(out[3].l, 24)
  assert.ok(out[2].l < 19 && out[2].l > 16, `Am en la parte cantada: ${out[2].l}`)
})

test('Marcar compás: con los «unos» marcados, los acordes de la línea ocupan tiempos completos y prefieren el «uno»', () => {
  // compás de 2 s (4 tiempos de 0,5 s) desde 10 s; la línea de «Zafar»: Am (2 tiempos), Dm (1), G (1)
  const bars = [10, 12, 14, 16]
  const grid = gridFromBars(bars, 4)
  assert.equal(grid.length, 13)
  const lines = [{ t: 9.8, end: 11.8 }, { t: 11.8, end: 13.8 }]
  const pts = [{ t: 9.8, chord: 'Am' }, { t: 10.9, chord: 'Dm' }, { t: 11.3, chord: 'G' }, { t: 11.8, chord: 'Am' }]
  const out = placeOnBeats(pts, lines, grid)
  assert.deepEqual(out.map((p) => p.t), [10, 11, 11.5, 12])
  // fuera de la parte marcada no se toca
  assert.deepEqual(placeOnBeats([{ t: 30.3, chord: 'C' }], [{ t: 30, end: 34 }], grid), [{ t: 30.3, chord: 'C' }])
})

test('Marcar pulso: compases para elegir y tiempo fuerte intermedio', () => {
  assert.deepEqual(Object.keys(METERS), ['2/4', '3/4', '4/4', '5/4', '6/8', '12/8'])
  assert.equal(midBeat({ bars: [], bpb: 6, meter: '6/8' }), 4)
  assert.equal(midBeat({ bars: [], bpb: 4 }), 3) // marcas guardadas antes de elegir compás
  assert.equal(gridFromBars([0, 3], 6).length, 7)
})
