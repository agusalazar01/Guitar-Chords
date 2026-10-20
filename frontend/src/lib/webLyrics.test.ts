import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanWebLyrics } from './webLyrics.ts'

test('cleanWebLyrics: deja las estrofas y saca restos de la página', () => {
  const raw = 'Compartir\r\nSoy de la ciudad con todo lo que ves\n  con su ruido, con su gente, consume vejez.  \n\n\n\nMe voy, volando por ahí\nhttps://www.ejemplo.com/zafar\n© 2024 Todos los derechos reservados\n\n'
  assert.equal(cleanWebLyrics(raw), 'Soy de la ciudad con todo lo que ves\ncon su ruido, con su gente, consume vejez.\n\nMe voy, volando por ahí')
})
test('cleanWebLyrics: no saca versos que empiezan con palabras comunes', () => {
  assert.equal(cleanWebLyrics('Escuchame bien\nSeguir andando'), 'Escuchame bien\nSeguir andando')
})
