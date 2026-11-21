import { Billboard, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/** How long a layout change takes to play out, in seconds. */
const TWEEN_SECONDS = 0.85

/** Beyond this many points, labelling all of them is illegible mush. */
const LABEL_BUDGET = 70

/** Screen-space box a label claims, in CSS pixels. */
const LABEL_CLEAR_X = 54
const LABEL_CLEAR_Y = 13

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Geometry per marker shape.
 *
 * Built once and shared by every point using that shape — a fresh geometry per
 * point would be forty allocations on every render of a scene that re-renders
 * whenever the pointer moves.
 */
function useGeometries() {
  return useMemo(
    () => ({
      sphere: new THREE.SphereGeometry(1, 18, 14),
      box: new THREE.BoxGeometry(1.5, 1.5, 1.5),
      octahedron: new THREE.OctahedronGeometry(1.25),
      tetrahedron: new THREE.TetrahedronGeometry(1.4),
      cone: new THREE.ConeGeometry(1.2, 2, 14),
      cylinder: new THREE.CylinderGeometry(1, 1, 1.8, 14),
      torus: new THREE.TorusGeometry(0.9, 0.42, 10, 16),
      dodecahedron: new THREE.DodecahedronGeometry(1.2),
    }),
    [],
  )
}

/**
 * The markers, and the one piece of motion in the application.
 *
 * When the projection method changes, the same words are still on screen — so
 * the points travel to their new coordinates instead of cutting. That
 * transition is not decoration: watching which words stay together and which
 * fly apart *is* the comparison between two methods, and it is the thing a
 * pair of static screenshots cannot show. New words arrive from the origin so
 * that adding one reads as an arrival rather than as a flicker.
 */
export default function PointCloud({
  points,
  colourFor,
  markFor,
  focus,
  hover,
  onFocus,
  onHover,
  showLabels,
  reducedMotion,
}) {
  const geometries = useGeometries()
  const { camera, size } = useThree()
  const groupRef = useRef()
  const meshRefs = useRef(new Map())
  const labelRefs = useRef(new Map())

  // Where each word is right now, where it is heading, and how far along.
  const from = useRef(new Map())
  const progress = useRef(1)
  const frame = useRef(0)
  const projected = useRef(new THREE.Vector3())

  const targets = useMemo(() => {
    const map = new Map()
    points.forEach((p) => map.set(p.word, [p.x, p.y, p.z]))
    return map
  }, [points])

  useEffect(() => {
    const next = new Map()
    targets.forEach((target, word) => {
      const current = from.current.get(word)
      // A word that was not here before starts at the centre and flies out,
      // which reads as "this was just added" without needing a caption.
      next.set(word, current || [target[0] * 0.04, target[1] * 0.04, target[2] * 0.04])
    })
    from.current = next
    progress.current = reducedMotion ? 1 : 0
  }, [targets, reducedMotion])

  useFrame((_, delta) => {
    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta / TWEEN_SECONDS)
    }
    const t = easeInOutCubic(progress.current)
    targets.forEach((target, word) => {
      const start = from.current.get(word) || target
      const x = start[0] + (target[0] - start[0]) * t
      const y = start[1] + (target[1] - start[1]) * t
      const z = start[2] + (target[2] - start[2]) * t
      const mesh = meshRefs.current.get(word)
      if (mesh) mesh.position.set(x, y, z)
      const label = labelRefs.current.get(word)
      if (label) label.position.set(x, y + 0.055, z)
    })
    if (progress.current >= 1) {
      // Freeze the finished positions so the next change interpolates from
      // where things actually are.
      targets.forEach((target, word) => from.current.set(word, target))
    }

    // ---- Label decluttering -------------------------------------------------
    // Words cluster, so their labels collide, and two overlapping words are
    // less readable than one word and a dot. Each label is projected to screen
    // space and claims a small box; nearer labels claim first, so when a pair
    // collides the one in front wins and the one behind hides — which is also
    // the correct depth cue. The focused and hovered words always win, because
    // a label that vanishes when you point at it is worse than a collision.
    // Every third frame: this is O(n^2) in the labels, and nothing here moves
    // fast enough to need 60 Hz.
    frame.current += 1
    if (frame.current % 3 === 0 && labelRefs.current.size) {
      const placed = []
      const candidates = []
      labelRefs.current.forEach((label, word) => {
        projected.current.set(label.position.x, label.position.y, label.position.z)
        projected.current.project(camera)
        candidates.push({
          label,
          word,
          sx: (projected.current.x * 0.5 + 0.5) * size.width,
          sy: (-projected.current.y * 0.5 + 0.5) * size.height,
          depth: projected.current.z,
        })
      })
      candidates.sort((a, b) => a.depth - b.depth)
      for (const candidate of candidates) {
        const pinned = candidate.word === focus || candidate.word === hover
        const clash =
          !pinned &&
          placed.some(
            (other) =>
              Math.abs(other.sx - candidate.sx) < LABEL_CLEAR_X &&
              Math.abs(other.sy - candidate.sy) < LABEL_CLEAR_Y,
          )
        candidate.label.visible = !clash
        if (!clash) placed.push(candidate)
      }
    }
  })

  const labelled = useMemo(() => {
    if (!showLabels) {
      // With labels off, still name whatever is being pointed at or inspected
      // — an unlabelled point cloud is pretty and useless.
      const keep = new Set()
      if (focus) keep.add(focus)
      if (hover) keep.add(hover)
      return keep
    }
    if (points.length <= LABEL_BUDGET) return new Set(points.map((p) => p.word))
    const keep = new Set()
    if (focus) keep.add(focus)
    if (hover) keep.add(hover)
    return keep
  }, [showLabels, points, focus, hover])

  return (
    <group ref={groupRef}>
      {points.map((point) => {
        const mark = markFor(point)
        const isFocus = focus === point.word
        const isHover = hover === point.word
        const scale = isFocus ? 0.036 : isHover ? 0.03 : 0.021
        return (
          <mesh
            key={point.word}
            ref={(node) => {
              if (node) meshRefs.current.set(point.word, node)
              else meshRefs.current.delete(point.word)
            }}
            geometry={geometries[mark.shape] || geometries.sphere}
            scale={scale}
            onPointerOver={(event) => {
              event.stopPropagation()
              onHover(point.word)
            }}
            onPointerOut={() => onHover(null)}
            onClick={(event) => {
              event.stopPropagation()
              onFocus(isFocus ? null : point.word)
            }}
          >
            <meshLambertMaterial
              color={colourFor(point)}
              emissive={isFocus || isHover ? '#ffffff' : '#000000'}
              emissiveIntensity={isFocus ? 0.4 : isHover ? 0.2 : 0}
            />
          </mesh>
        )
      })}

      {points
        .filter((point) => labelled.has(point.word))
        .map((point) => {
          const isFocus = focus === point.word
          const isHover = hover === point.word
          return (
            <Billboard
              key={`label-${point.word}`}
              ref={(node) => {
                if (node) labelRefs.current.set(point.word, node)
                else labelRefs.current.delete(point.word)
              }}
            >
              <Suspense fallback={null}>
              <Text
                fontSize={isFocus ? 0.058 : 0.044}
                color={isFocus || isHover ? '#ffffff' : '#c3c2b7'}
                anchorX="center"
                anchorY="bottom"
                maxWidth={0.9}
                /* An outline in the surface colour is what keeps a label
                   readable when it lands on top of another one, which in a
                   dense cloud is most of the time. */
                outlineWidth={0.0042}
                outlineColor="#1a1a19"
                onClick={(event) => {
                  event.stopPropagation()
                  onFocus(isFocus ? null : point.word)
                }}
                onPointerOver={(event) => {
                  event.stopPropagation()
                  onHover(point.word)
                }}
                onPointerOut={() => onHover(null)}
              >
                {point.word}
              </Text>
              </Suspense>
            </Billboard>
          )
        })}
    </group>
  )
}
