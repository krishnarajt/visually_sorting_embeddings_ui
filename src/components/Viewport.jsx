import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { Maximize, Pause, Play, ZoomIn, ZoomOut } from 'lucide-react'
import { useRef, useState } from 'react'

import PointCloud from './PointCloud'
import NeighbourEdges from './NeighbourEdges'
import Axes from './Axes'

/**
 * The window into the model.
 *
 * Three decisions worth knowing about:
 *
 * 1. Rotation is on by default, slowly. A static 3-D scatter projected onto a
 *    2-D screen is a 2-D scatter with worse occlusion — depth only becomes
 *    readable once things move relative to each other. It stops the moment the
 *    user touches the camera, because after that they are driving.
 *
 * 2. Axes are drawn for PCA and raw dimensions and for nothing else. In t-SNE,
 *    UMAP and MDS the axes carry no meaning at all — the layout is only
 *    defined up to rotation — so drawing a labelled frame around them would be
 *    inventing a reading the data does not support. Their absence is the
 *    honest signal, and it teaches the point better than a caption would.
 *
 * 3. The camera sits at a fixed distance, because the server normalises every
 *    layout to radius 1 before sending it. Refitting the camera per scene
 *    would silently rescale the view and make two methods look more alike
 *    than they are.
 *
 * 4. Fog, not just perspective, for depth. Distance-dimming on a dark ground
 *    is the cheapest legible depth cue and it degrades gracefully: a word
 *    behind another is dimmer rather than hidden.
 */
export default function Viewport({
  points,
  colourFor,
  markFor,
  focus,
  comparison,
  hover,
  onFocus,
  onHover,
  edges,
  showLabels,
  method,
  projectionMeta,
  sourceDims,
  reducedMotion,
}) {
  const [userDriving, setUserDriving] = useState(false)
  const controlsRef = useRef()

  const autoRotate = !userDriving && !reducedMotion
  const referencePoint = points.find((point) => point.word === focus)
  const comparisonPoint = points.find((point) => point.word === comparison)

  function zoom(factor) {
    const controls = controlsRef.current
    if (!controls) return
    const distance = controls.object.position.distanceTo(controls.target)
    if (!distance) return
    const next = Math.max(controls.minDistance, Math.min(controls.maxDistance, distance * factor))
    controls.object.position.sub(controls.target).multiplyScalar(next / distance).add(controls.target)
    controls.update()
    setUserDriving(true)
  }

  return (
    <div className="on-vacuum relative h-full w-full">
      <Canvas
        camera={{ position: [1.65, 1.1, 1.9], fov: 42, near: 0.01, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onPointerMissed={() => onFocus(null)}
      >
        <color attach="background" args={['#1a1a19']} />
        <fog attach="fog" args={['#1a1a19', 2.2, 5.2]} />

        {/* Enough light to read a silhouette by. The markers are matte so the
            shape reads as shape rather than as a highlight. */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 4, 2]} intensity={1.4} />
        <directionalLight position={[-3, -2, -2]} intensity={0.5} />

        <Axes method={method} meta={projectionMeta} sourceDims={sourceDims} />

        <NeighbourEdges edges={edges} points={points} />

        {referencePoint && comparisonPoint ? <Line
          points={[[referencePoint.x, referencePoint.y, referencePoint.z], [comparisonPoint.x, comparisonPoint.y, comparisonPoint.z]]}
          color="#f3b58a" lineWidth={1.4} dashed dashSize={0.025} gapSize={0.015}
          transparent opacity={0.7}
        /> : null}

        <PointCloud
          points={points}
          colourFor={(point) => point.word === comparison ? '#f3b58a' : colourFor(point)}
          markFor={markFor}
          focus={focus}
          hover={hover}
          onFocus={onFocus}
          onHover={onHover}
          showLabels={showLabels}
          reducedMotion={reducedMotion}
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          minDistance={0.6}
          maxDistance={9}
          autoRotate={autoRotate}
          autoRotateSpeed={0.42}
          onStart={() => setUserDriving(true)}
        />
      </Canvas>
      <div className="camera-controls" role="group" aria-label="Camera controls">
        <button type="button" className="instrument-button" aria-label={autoRotate ? 'Pause rotation' : 'Resume rotation'} title={autoRotate ? 'Pause rotation' : 'Resume rotation'} disabled={reducedMotion} onClick={() => setUserDriving((current) => !current)}>{autoRotate ? <Pause size={15} /> : <Play size={15} />}</button>
        <button type="button" className="instrument-button" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(0.8)}><ZoomIn size={15} /></button>
        <button type="button" className="instrument-button" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(1.25)}><ZoomOut size={15} /></button>
        <button type="button" className="instrument-button" aria-label="Reset camera" title="Reset camera" onClick={() => { controlsRef.current?.reset(); setUserDriving(true) }}><Maximize size={15} /></button>
      </div>
    </div>
  )
}
