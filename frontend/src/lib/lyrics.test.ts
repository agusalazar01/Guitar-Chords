import test from 'node:test'
import assert from 'node:assert/strict'
import { activeLine, cleanTitle, matchScore, parseLrc, pickAuto, rankResults } from './lyrics.ts'
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
