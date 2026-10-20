import test from 'node:test'
import assert from 'node:assert/strict'
import { mainArtist, songbookText, activeLine, cleanTitle, fitAnchors, matchScore, parseLrc, pickAuto, rankResults } from './lyrics.ts'
import type { LyricResult } from './lyrics.ts'

test('parseLrc: tiempos, varias marcas por línea, etiquetas ignoradas y orden', () => {
  const l = parseLrc('[ar:Artista]\n[00:12.50] Primera\n[01:02.00][00:30.25] Repetida\n[00:00.00]\nsin marca')
  assert.deepEqual(l.map((x) => [x.t, x.text]), [[0, ''], [12.5, 'Primera'], [30.25, 'Repetida'], [62, 'Repetida']])
})

test('activeLine: búsqueda binaria', () => {
  const l = [{ t: 1, text: 'a' }, { t: 5, text: 'b' }, { t: 9, text: 'c' }]
  assert.equal(activeLine(l, 0.5), -1)
  assert.equal(activeLine(l, 1), 0)
  assert.equal(activeLine(l, 7), 1)
  assert.equal(activeLine(l, 100), 2)
})

test('cleanTitle: quita relleno de títulos de YouTube y extensiones', () => {
  assert.equal(cleanTitle('Alfredo Zitarrosa - Guitarrero Viejo (Video Oficial) [HD]'), 'Alfredo Zitarrosa Guitarrero Viejo')
  assert.equal(cleanTitle('No Te Va Gustar - A las nueve | Official Video'), 'No Te Va Gustar A las nueve')
  assert.equal(cleanTitle('fito_paez-11 y 6.mp3'), 'fito paez-11 y 6')
})

const R = (p: Partial<LyricResult>): LyricResult => ({ id: 1, trackName: 'Guitarrero viejo', artistName: 'Alfredo Zitarrosa', albumName: null, duration: 243, plainLyrics: 'x', syncedLyrics: '[00:01.00] x', ...p })

test('matchScore y pickAuto: elige solo con título y duración que coinciden', () => {
  assert.ok(matchScore(R({}), 'guitarrero viejo zitarrosa') > 0.9)
  assert.ok(matchScore(R({ trackName: 'Otra canción' }), 'guitarrero viejo zitarrosa') < 0.5)
  assert.equal(pickAuto([R({ duration: 241 })], 'Zitarrosa Guitarrero Viejo', 242)?.duration, 241)
  assert.equal(pickAuto([R({ duration: 200 })], 'Zitarrosa Guitarrero Viejo', 242), null) // otra versión
  assert.equal(pickAuto([R({ syncedLyrics: null })], 'Zitarrosa Guitarrero Viejo', 243), null) // sin tiempos
  assert.equal(pickAuto([R({})], 'Zitarrosa Guitarrero Viejo', null), null) // sin duración no se adivina
})

test('rankResults: primero con tiempos y sin duplicados', () => {
  const r = rankResults([R({ id: 1, syncedLyrics: null }), R({ id: 2 }), R({ id: 3 }), R({ id: 4, trackName: 'Otra', plainLyrics: null, syncedLyrics: null })], 'guitarrero viejo', null)
  assert.deepEqual(r.map((x) => x.id), [2, 1])
})

import { addAnchor, audioTime, lyricTime } from './lyrics.ts'
test('puntos de ajuste: intro más larga y versión más lenta', () => {
  assert.equal(lyricTime(30), 30) // sin ajuste
  const one = addAnchor([], 20, 35) // la letra empieza a los 20 s pero el canto entra a los 35 s
  assert.equal(lyricTime(35, one), 20)
  assert.equal(lyricTime(10, one), -5) // antes del canto: la letra no empezó
  const two = addAnchor(one, 120, 145) // 100 s de letra duran 110 s en vivo
  assert.ok(Math.abs(lyricTime(90, two) - 70) < 1e-9)
  assert.ok(Math.abs(audioTime(70, two) - 90) < 1e-9)
  assert.equal(lyricTime(150, two), 125)
  assert.deepEqual(addAnchor(two, 60, 200).map((a) => a.l), [20, 60]) // contradice el de 120 s: se descarta
})

import { parseVideoTitle, pickConfident, pastedLyrics } from './lyrics.ts'
test('parseVideoTitle: artista y canción del título del video', () => {
  assert.deepEqual(parseVideoTitle('Julieta Venegas - Me Voy (Video Oficial)'), { artist: 'Julieta Venegas', title: 'Me Voy', query: 'Julieta Venegas Me Voy' })
  assert.equal(parseVideoTitle('Mix - Julieta Venegas - Lento [HD]').title, 'Lento')
  assert.equal(parseVideoTitle('Buenas Noches').artist, null)
})
test('pickConfident: título solo no alcanza; título + artista o título + duración sí', () => {
  const sayMo = R({ id: 1, trackName: 'Buenas Noches', artistName: 'Say Mo', duration: 125 })
  const darnu = R({ id: 2, trackName: 'Buenas noches', artistName: 'Eduardo Darnauchans', duration: 117 })
  assert.equal(pickConfident([sayMo, darnu], { artist: null, title: 'Buenas Noches' }, 140), null)
  assert.equal(pickConfident([sayMo, darnu], { artist: null, title: 'Buenas Noches' }, 118)?.id, 2) // duración ±3 s
  assert.equal(pickConfident([sayMo, darnu], { artist: 'Eduardo Darnauchans', title: 'Buenas Noches' }, 200)?.id, 2)
  assert.equal(pickConfident([sayMo], { artist: 'Julieta Venegas', title: 'Me Voy' }, 180), null)
})
test('pastedLyrics: con o sin tiempos', () => {
  assert.ok(pastedLyrics('[00:01.00] a\n[00:02.00] b\n[00:03.00] c', 'x').synced)
  assert.equal(pastedLyrics('una\nletra', 'x').plain, 'una\nletra')
})

test('texto limpio para buscar el cifrado (canción + artista principal)', () => {
  assert.equal(songbookText('Nada Fué Un Error', 'Coti (Feat. Paulina Rubio & Julieta Venegas)'), 'Nada Fué Un Error Coti')
  assert.equal(songbookText('Me Voy (En Vivo) [Official Video]', 'Julieta Venegas'), 'Me Voy Julieta Venegas')
  assert.equal(songbookText('Carta Para No Llorar - Remastered 2015', 'Los Olimareños'), 'Carta Para No Llorar Los Olimareños')
  assert.equal(songbookText('Tu Misterioso Alguien ft. Otro Artista', 'Miranda! & Alguien'), 'Tu Misterioso Alguien Miranda!')
  assert.equal(mainArtist('Calamaro, Fito Páez'), 'Calamaro')
  assert.equal(mainArtist('Coti x Julieta Venegas'), 'Coti')
  const v = parseVideoTitle('Julieta Venegas ft. Coti - Nada Fue Un Error (Video Oficial) | HD')
  assert.equal(songbookText(v.title, v.artist), 'Nada Fue Un Error Julieta Venegas')
  const w = parseVideoTitle('Coti (Feat. Paulina Rubio & Julieta Venegas) Nada Fué Un Error')
  assert.equal(songbookText(w.title, w.artist), 'Coti Nada Fué Un Error')
})

test('fitAnchors: estira la letra de otra grabación a la duración del video', () => {
  const lines = [{ t: 10, text: 'uno' }, { t: 20, text: '' }, { t: 100, text: 'fin' }]
  const a = fitAnchors(lines, 200, 220)
  assert.deepEqual(a, [{ l: 10, t: 11 }, { l: 100, t: 110 }])
  assert.equal(Math.round(audioTime(55, a) * 10) / 10, 60.5)
  assert.deepEqual(fitAnchors(lines, 0, 220), [])
})
