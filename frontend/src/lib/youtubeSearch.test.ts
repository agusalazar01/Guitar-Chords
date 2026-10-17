import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDuration, searchVideos } from './youtubeSearch.ts'

test('duración ISO 8601', () => {
  assert.equal(parseDuration('PT3M45S'), '3:45'); assert.equal(parseDuration('PT1H2M3S'), '1:02:03')
  assert.equal(parseDuration('P0D'), null); assert.equal(parseDuration(''), null)
})
test('sin clave: error claro y no inventa resultados', async () => {
  await assert.rejects(() => searchVideos('hola', ''), /clave/)
})
test('con fetch simulado: filtra no embebibles y mapea errores de cuota', async () => {
  const real = globalThis.fetch
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
  globalThis.fetch = (async (u: string) => u.includes('/search')
    ? json({ items: [{ id: { videoId: 'AAAAAAAAAAA' }, snippet: { title: 't1', channelTitle: 'c', thumbnails: { medium: { url: 'x' } } } }, { id: { videoId: 'BBBBBBBBBBB' }, snippet: { title: 't2', channelTitle: 'c' } }] })
    : json({ items: [{ id: 'AAAAAAAAAAA', contentDetails: { duration: 'PT2M5S' }, status: { embeddable: true } }, { id: 'BBBBBBBBBBB', contentDetails: {}, status: { embeddable: false } }] })) as typeof fetch
  try {
    const r = await searchVideos('q', 'k')
    assert.deepEqual(r.map((v) => [v.id, v.duration]), [['AAAAAAAAAAA', '2:05']])
    globalThis.fetch = (async () => json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403)) as typeof fetch
    await assert.rejects(() => searchVideos('q', 'k'), /cuota/)
  } finally { globalThis.fetch = real }
})
