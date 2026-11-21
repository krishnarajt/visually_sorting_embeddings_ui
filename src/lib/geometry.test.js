import assert from 'node:assert/strict'
import test from 'node:test'

import { contrastCoordinates, cosineAngle, neighbourRanks, wordCoordinates } from './geometry.js'

const vectors = [
  [1, 0, 0],
  [0.6, 0.8, 0],
  [-1, 0, 0],
  [0, 0, 1],
]
const matrix = vectors.map((left) =>
  vectors.map((right) => left.reduce((sum, value, index) => sum + value * right[index], 0)),
)

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} should equal ${expected}`)
}

test('word axes put the reference on x and preserve exact reference cosines', () => {
  const coordinates = wordCoordinates(matrix, 0, 1)
  coordinates.forEach((point, index) => {
    close(point.x, vectors[index][0])
    close(point.y, vectors[index][1])
  })
  close(coordinates[0].retained, 1)
  close(coordinates[3].retained, 0)
})

test('word axes reject identical or opposite directions', () => {
  assert.equal(wordCoordinates(matrix, 0, 0), null)
  assert.equal(wordCoordinates(matrix, 0, 2), null)
})

test('contrast axes use the normalized difference of the two word vectors', () => {
  const coordinates = contrastCoordinates(matrix, 0, 1)
  const length = Math.hypot(-0.4, 0.8)
  vectors.forEach((vector, index) => {
    close(coordinates[index].value, (-0.4 * vector[0] + 0.8 * vector[1]) / length)
  })
  close(coordinates[0].value, -coordinates[1].value)
})

test('swapping contrast poles reverses the axis', () => {
  const forward = contrastCoordinates(matrix, 0, 1)
  const reverse = contrastCoordinates(matrix, 1, 0)
  forward.forEach((point, index) => close(point.value, -reverse[index].value))
  assert.equal(contrastCoordinates(matrix, 0, 0), null)
})

test('cosine angles are degrees, with rounding clamped at the endpoints', () => {
  close(cosineAngle(1.00000001), 0)
  close(cosineAngle(0.5), 60)
  close(cosineAngle(0), 90)
  close(cosineAngle(-1.00000001), 180)
})

test('cosine neighbours and 3D neighbours are ranked independently', () => {
  const points = [
    { word: 'reference', x: 0, y: 0, z: 0 },
    { word: 'similar', x: 100, y: 0, z: 0 },
    { word: 'opposite', x: 1, y: 0, z: 0 },
    { word: 'orthogonal', x: 2, y: 0, z: 0 },
  ]
  const ranking = neighbourRanks(points, matrix, 0)
  assert.equal(ranking.length, 3)
  assert.equal(ranking[0].word, 'similar')
  assert.equal(ranking[0].vectorRank, 1)
  assert.equal(ranking[0].mapRank, 3)
  assert.equal(ranking[2].word, 'opposite')
  assert.equal(ranking[2].mapRank, 1)
})