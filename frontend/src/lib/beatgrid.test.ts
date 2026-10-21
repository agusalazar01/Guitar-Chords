import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beatLabels } from './beatgrid.ts'

test('rejilla: todos los acordes aparecen, aunque entren entre golpes o dos en el mismo tiempo', () => {
  const beats = [0, 0.5, 1, 1.5, 2, 2.5]
  const seg = (start: number, end: number, chord: string) => ({ start, end, chord, confidence: null })
  const segs = [seg(0, 0.7, 'C'), seg(0.7, 0.9, 'D7'), seg(0.9, 1.3, 'Em7'), seg(1.3, 2.6, 'Dsus4')]
  assert.deepEqual(beatLabels(segs as never, beats, 0, 5), [['C'], ['D7', 'Em7'], ['Dsus4'], [], []])
})
