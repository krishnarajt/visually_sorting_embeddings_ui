import { Billboard, Text } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'

import { pct } from '../lib/format'

/**
 * Axes, only where axes mean something.
 *
 * PCA's axes are the three directions of greatest variance and are worth
 * labelling with how much variance each one actually accounts for — that
 * number is the honest headline of the method. Raw mode's axes are literally
 * dimensions 41, 42 and 43 of the vector, so they get named too.
 *
 * t-SNE, UMAP, MDS and random projection get nothing. Their layouts are
 * defined only up to rotation: turn the cloud and it is the same answer, which
 * means there is no "x" to label. Drawing a frame anyway is the most common way
 * these plots mislead people, so the frame is absent and the explain panel says
 * why.
 */
const LABELLED = {
  pca: (meta) => {
    const ratios = meta?.explained_variance_ratio || []
    return [
      `PC1 · ${pct(ratios[0])} of variance`,
      `PC2 · ${pct(ratios[1])}`,
      `PC3 · ${pct(ratios[2])}`,
    ]
  },
  raw: (meta) => {
    const dims = meta?.dims || [0, 1, 2]
    return [`dimension ${dims[0]}`, `dimension ${dims[1]}`, `dimension ${dims[2]}`]
  },
}

export default function Axes({ method, meta, sourceDims }) {
  const labels = LABELLED[method]?.(meta)

  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector3(-1.15, 0, 0),
      new THREE.Vector3(1.15, 0, 0),
      new THREE.Vector3(0, -1.15, 0),
      new THREE.Vector3(0, 1.15, 0),
      new THREE.Vector3(0, 0, -1.15),
      new THREE.Vector3(0, 0, 1.15),
    ]
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [])

  if (!labels) return null

  const ends = [
    [1.24, 0, 0],
    [0, 1.24, 0],
    [0, 0, 1.24],
  ]

  return (
    <group>
      <lineSegments geometry={geometry}>
        {/* Recessive on purpose: the axes are reference, not content. */}
        <lineBasicMaterial color="#4a4a46" transparent opacity={0.85} />
      </lineSegments>
      {ends.map((position, i) => (
        <Billboard key={i} position={position}>
          <Suspense fallback={null}>
          <Text
            fontSize={0.052}
            color="#c3c2b7"
            anchorX="left"
            anchorY="middle"
            outlineWidth={0.004}
            outlineColor="#1a1a19"
          >
            {labels[i]}
          </Text>
          </Suspense>
        </Billboard>
      ))}
    </group>
  )
}
