import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Lines from the focused word to its true nearest neighbours.
 *
 * This is the component that makes the app honest. The neighbours are computed
 * on the full-dimensional vectors, so an edge can and does run to a point on
 * the far side of the screen — and when it does, that is the projection being
 * caught out. Without the edges, "these two look close so they must be
 * similar" is an inference the picture invites and cannot support; with them,
 * the real relationship is drawn on top of the approximate one.
 *
 * Opacity carries the similarity, so a weak neighbour looks like a weak
 * neighbour.
 */
export default function NeighbourEdges({ edges, points }) {
  const positions = useMemo(() => {
    const map = new Map()
    points.forEach((p) => map.set(p.word, [p.x, p.y, p.z]))
    return map
  }, [points])

  const lines = useMemo(() => {
    if (!edges?.length) return []
    return edges
      .map((edge) => {
        const a = positions.get(edge.from)
        const b = positions.get(edge.to)
        if (!a || !b) return null
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...a),
          new THREE.Vector3(...b),
        ])
        return { geometry, similarity: edge.similarity, key: `${edge.from}->${edge.to}` }
      })
      .filter(Boolean)
  }, [edges, positions])

  return (
    <group>
      {lines.map((line) => (
        <line key={line.key} geometry={line.geometry}>
          <lineBasicMaterial
            color="#3987e5"
            transparent
            /* Floor of 0.18 so a genuine-but-weak neighbour is still visible;
               a line nobody can see is the same as no line. */
            opacity={Math.max(0.18, Math.min(0.95, line.similarity))}
          />
        </line>
      ))}
    </group>
  )
}
