export function clampCosine(value) {
  return Math.max(-1, Math.min(1, value))
}

export function cosineAngle(value) {
  return (Math.acos(clampCosine(value)) * 180) / Math.PI
}

export function wordCoordinates(matrix, referenceIndex, guideIndex) {
  const shared = clampCosine(matrix[referenceIndex][guideIndex])
  const perpendicular = Math.sqrt(Math.max(0, 1 - shared ** 2))
  if (perpendicular < 1e-6) return null

  return matrix.map((row) => {
    const x = clampCosine(row[referenceIndex])
    const y = (row[guideIndex] - shared * x) / perpendicular
    return { x, y, retained: Math.min(1, x ** 2 + y ** 2) }
  })
}

export function contrastCoordinates(matrix, fromIndex, toIndex) {
  const length = Math.sqrt(Math.max(0, 2 - 2 * clampCosine(matrix[fromIndex][toIndex])))
  if (length < 1e-6) return null

  return matrix.map((row) => ({
    value: clampCosine((row[toIndex] - row[fromIndex]) / length),
    fromSimilarity: row[fromIndex],
    toSimilarity: row[toIndex],
  }))
}

export function neighbourRanks(points, matrix, referenceIndex) {
  const reference = points[referenceIndex]
  const neighbours = points.flatMap((point, index) => index === referenceIndex ? [] : [{
    word: point.word,
    similarity: clampCosine(matrix[referenceIndex][index]),
    distance: Math.hypot(point.x - reference.x, point.y - reference.y, point.z - reference.z),
  }])
  const mapRanks = new Map([...neighbours].sort((left, right) => left.distance - right.distance)
    .map((point, index) => [point.word, index + 1]))
  return neighbours.sort((left, right) => right.similarity - left.similarity)
    .map((point, index) => ({ ...point, vectorRank: index + 1, mapRank: mapRanks.get(point.word) }))
}