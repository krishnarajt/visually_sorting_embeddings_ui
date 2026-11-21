import { ArrowLeftRight, Axis3D, MoveHorizontal, Orbit } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { contrastCoordinates, wordCoordinates } from '../lib/geometry'

const LENSES = [
  { id: 'map', label: '3D map', icon: Orbit },
  { id: 'axes', label: 'Word axes', icon: Axis3D },
  { id: 'contrast', label: 'Contrast', icon: MoveHorizontal },
]

export function LensControls({ lens, onLens, words, reference, guide, comparison, onReference, onGuide, onCompare }) {
  const other = lens === 'map' ? comparison : guide
  const onOther = lens === 'map' ? onCompare : onGuide

  return (
    <div className="lens-controls">
      <div className="lens-tabs" role="tablist" aria-label="Embedding view">
        {LENSES.map(({ id, label, icon: Icon }, index) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={lens === id}
            aria-controls="embedding-surface"
            tabIndex={lens === id ? 0 : -1}
            onClick={() => onLens(id)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? LENSES.length - 1 :
                (index + (event.key === 'ArrowRight' ? 1 : -1) + LENSES.length) % LENSES.length
              onLens(LENSES[next].id)
              event.currentTarget.parentElement.children[next].focus()
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div className="lens-selectors">
        <label className="word-select reference-select">
          <span>{lens === 'contrast' ? 'From' : 'Reference'}</span>
          <select aria-label="Reference word" value={reference || ''} onChange={(event) => onReference(event.target.value)} disabled={!words.length}>
            {words.map((word) => <option key={word}>{word}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="instrument-button"
          title="Swap axis words"
          aria-label="Swap axis words"
          disabled={!other}
          onClick={() => { onReference(other); onOther(reference) }}
        >
          <ArrowLeftRight size={16} />
        </button>
        <label className="word-select guide-select">
          <span>{lens === 'map' ? 'Compare' : lens === 'axes' ? 'Plane guide' : 'Toward'}</span>
          <select aria-label={lens === 'map' ? 'Map comparison word' : 'Axis guide word'} value={other || ''} onChange={(event) => onOther(event.target.value)} disabled={words.length < 2}>
            {words.filter((word) => word !== reference).map((word) => <option key={word}>{word}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

export default function EmbeddingLens({ lens, scene, reference, guide, comparison, onCompare, hover, onHover, sourceDims }) {
  const referenceIndex = scene.points.findIndex((point) => point.word === reference)
  const guideIndex = scene.points.findIndex((point) => point.word === guide)
  if (!scene.matrix || referenceIndex < 0 || guideIndex < 0) {
    return <div className="lens-empty">At least two embedded words are needed for an axis.</div>
  }
  const coordinates = lens === 'axes'
    ? wordCoordinates(scene.matrix, referenceIndex, guideIndex)
    : contrastCoordinates(scene.matrix, referenceIndex, guideIndex)

  if (!coordinates) {
    return <div className="lens-empty">These vectors define no independent axis. A different guide word is needed.</div>
  }

  return (
    <section className="embedding-lens" aria-label={lens === 'axes' ? 'Word-aligned projection' : 'Semantic contrast ranking'}>
      <header className="lens-heading">
        <div>
          <span className="eyebrow">{lens === 'axes' ? 'A slice through the original vectors' : 'A direction through embedding space'}</span>
          <h2>{lens === 'axes' ? 'The world along a word.' : 'Between two ideas.'}</h2>
        </div>
        <span className="dimension-stamp">{lens === 'axes' ? '2D plane' : '1D axis'}<small>from {sourceDims}D</small></span>
      </header>
      {lens === 'axes' ? (
        <WordPlane {...{ scene, coordinates, reference, guide, comparison, onCompare, hover, onHover }} />
      ) : (
        <ContrastPlot {...{ scene, coordinates, reference, guide, comparison, onCompare, onHover }} />
      )}
      <footer className="lens-footnote">
        {lens === 'axes' ? (
          <><span><b>x</b> = cosine with <strong>{reference}</strong></span><span><b>y</b> = component toward <strong>{guide}</strong> perpendicular to x</span></>
        ) : (
          <><span>axis = normalized(<strong>{guide}</strong> - <strong>{reference}</strong>)</span><span>0 = equal cosine to both words</span></>
        )}
      </footer>
    </section>
  )
}

function WordPlane({ scene, coordinates, reference, guide, comparison, onCompare, hover, onHover }) {
  const container = useRef(null)
  const [size, setSize] = useState({ width: 640, height: 460 })
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) })
    })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  const radius = Math.max(30, Math.min(size.width - 94, size.height - 98) / 2)
  const centerX = size.width / 2
  const centerY = size.height / 2 + 6
  const selected = hover || comparison
  const selectedIndex = scene.points.findIndex((point) => point.word === selected)
  const selectedCoordinate = coordinates[selectedIndex]
  const pins = [reference, guide, comparison, hover].filter(Boolean)
  const placed = []
  const labels = scene.points
    .map((point, index) => ({ ...point, ...coordinates[index], index }))
    .sort((left, right) => Number(pins.includes(right.word)) - Number(pins.includes(left.word)) || right.x - left.x)
    .flatMap((point) => {
      if (placed.length >= 14 && !pins.includes(point.word)) return []
      const width = Math.min(144, point.word.length * 7.2 + 12)
      const left = Math.max(8, Math.min(size.width - width - 8, centerX + point.x * radius - width / 2))
      const baseTop = centerY - point.y * radius
      const top = [-30, 12, -52, 34].map((offset) => baseTop + offset).find((candidate) =>
        candidate > 26 && candidate < size.height - 22 && !placed.some((box) =>
          left < box.left + box.width + 5 && left + width + 5 > box.left && candidate < box.top + 21 && candidate + 21 > box.top,
        ),
      )
      if (top === undefined) return []
      const label = { ...point, left, top, width }
      placed.push(label)
      return [label]
    })

  return (
    <div className="word-plane" ref={container} onMouseLeave={() => onHover(null)}>
      <div className="plane-readout" aria-live="polite">
        {selectedCoordinate ? <><strong>{selected}</strong><span>x {selectedCoordinate.x.toFixed(3)}</span><span title="Fraction of this unit vector's squared length outside the displayed plane">{Math.round((1 - selectedCoordinate.retained) * 100)}% outside this plane</span></> : null}
      </div>
      <svg className="plane-geometry" viewBox={`0 0 ${size.width} ${size.height}`} aria-label={`Unit-vector plane with ${reference} on the x-axis`}>
        <circle cx={centerX} cy={centerY} r={radius} className="plane-boundary" />
        <circle cx={centerX} cy={centerY} r={radius / 2} className="plane-grid" />
        <line x1={centerX - radius - 14} y1={centerY} x2={centerX + radius + 14} y2={centerY} className="plane-axis" />
        <line x1={centerX} y1={centerY - radius - 14} x2={centerX} y2={centerY + radius + 14} className="plane-axis" />
        {[-1, -0.5, 0, 0.5, 1].map((tick) => <text key={tick} x={centerX + tick * radius} y={centerY + 17} className="plane-tick" textAnchor="middle">{tick}</text>)}
        <text x={centerX + 10} y={centerY - radius - 10} className="plane-tick">y</text>
        <text x={centerX + radius + 22} y={centerY + 4} className="plane-tick">x</text>
        {scene.points.map((point, index) => {
          const coordinate = coordinates[index]
          const pointX = centerX + coordinate.x * radius
          const pointY = centerY - coordinate.y * radius
          const role = point.word === reference ? 'reference' : point.word === guide ? 'guide' : 'other'
          const active = point.word === selected || point.word === comparison
          return (
            <g key={point.word}>
              {(active || role !== 'other') && <line x1={centerX} y1={centerY} x2={pointX} y2={pointY} className={`plane-ray ${role}`} />}
              {active && <line x1={pointX} y1={pointY} x2={pointX} y2={centerY} className="plane-drop" />}
              <circle
                cx={pointX} cy={pointY} r={active || role !== 'other' ? 6 : 4}
                className={`plane-point ${role} ${active ? 'is-active' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Compare ${point.word}, cosine ${coordinate.x.toFixed(3)} with ${reference}`}
                onClick={() => onCompare(point.word)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCompare(point.word) }
                }}
                onMouseEnter={() => onHover(point.word)}
                onFocus={() => onHover(point.word)}
                onBlur={() => onHover(null)}
              ><title>{point.word}: x {coordinate.x.toFixed(3)}, y {coordinate.y.toFixed(3)}</title></circle>
            </g>
          )
        })}
      </svg>
      {labels.map((label) => (
        <button
          type="button"
          key={label.word}
          className={`plane-label ${label.word === reference ? 'reference' : label.word === guide ? 'guide' : ''}`}
          style={{ left: label.left, top: label.top, width: label.width }}
          title={label.word}
          onClick={() => onCompare(label.word)}
          onMouseEnter={() => onHover(label.word)}
        >{label.word}</button>
      ))}
    </div>
  )
}

function ContrastPlot({ scene, coordinates, reference, guide, comparison, onCompare, onHover }) {
  const ranking = scene.points.map((point, index) => ({ ...point, ...coordinates[index] }))
    .sort((left, right) => right.value - left.value)

  return (
    <div className="contrast-plot">
      <div className="contrast-scale"><span>Word</span><div><span>-1</span><span>0</span><span>+1</span></div><span>Cosine</span></div>
      <div className="contrast-rows" onMouseLeave={() => onHover(null)}>
        {ranking.map((point) => (
          <button
            type="button"
            key={point.word}
            className={`contrast-row ${point.word === comparison ? 'is-selected' : ''}`}
            onClick={() => onCompare(point.word)}
            onMouseEnter={() => onHover(point.word)}
            aria-pressed={point.word === comparison}
            title={`${point.word}: ${point.value.toFixed(3)} along ${reference} to ${guide}; cosine to ${reference} ${point.fromSimilarity.toFixed(3)}, to ${guide} ${point.toSimilarity.toFixed(3)}`}
          >
            <span className="contrast-word">{point.word}{point.word === reference ? <small>from</small> : point.word === guide ? <small>toward</small> : null}</span>
            <span className="contrast-track">
              <span className={`contrast-stem ${point.value < 0 ? 'negative' : 'positive'}`} style={{ left: `${50 + Math.min(0, point.value) * 50}%`, width: `${Math.abs(point.value) * 50}%` }} />
              <span className={`contrast-dot ${point.value < 0 ? 'negative' : 'positive'}`} style={{ left: `${(point.value + 1) * 50}%` }} />
            </span>
            <span className="tnum">{point.value > 0 ? '+' : ''}{point.value.toFixed(3)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}