import test from 'node:test'
import assert from 'node:assert/strict'
import { isEmptyDraft } from './draft.ts'

const seg = [{ start: 0, end: 1, chord: 'C' }]
test('isEmptyDraft: solo la letra sin acordes, audio ni video es borrador', () => {
  assert.equal(isEmptyDraft({ settings: { videoId: null }, audio: null, original: [] }), true)
  assert.equal(isEmptyDraft({ settings: {}, original: [] }), true)
})
test('isEmptyDraft: una canción con acordes, video o audio NO es borrador (se limpia al elegir otro video)', () => {
  assert.equal(isEmptyDraft({ settings: { videoId: null }, audio: null, original: seg }), false)
  assert.equal(isEmptyDraft({ settings: { videoId: 'abc12345678' }, audio: null, original: [] }), false)
  assert.equal(isEmptyDraft({ settings: { videoId: null }, audio: new Blob(['x']), original: [] }), false)
  assert.equal(isEmptyDraft(null), false)
})
