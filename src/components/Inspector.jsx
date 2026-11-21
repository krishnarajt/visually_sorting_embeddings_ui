import { ScanSearch } from 'lucide-react'
import { useEffect, useState } from 'react'

import { sim } from '../lib/format'
import { cosineAngle, neighbourRanks } from '../lib/geometry'

/**
 * One word, up close.
 *
 * Two neighbour lists, deliberately separate, because they answer different
 * questions and conflating them is how these tools mislead:
 *
 *   "On screen"    — the nearest of the words currently plotted. These are the
 *                    ones the edges in the view are drawn to.
 *   "In the model" — the nearest of everything the source knows, which for
 *                    GloVe is fifty thousand words the user never typed. This
 *                    is the list that shows what the model actually thinks, and
 *                    it regularly contains something that changes your mind
 *                    about the word.
 *
 * Both are full-dimensional cosine. Neither is read off the plot.
 */
export default function Inspector({ word, comparison, scene, client, source, sourceDims, method, onCompare, onAdd }) {
  const [wide, setWide] = useState(null)
  const [error, setError] = useState('')
  const [order, setOrder] = useState('vector')

  useEffect(() => {
    if (!word) return
    let cancelled = false
    setWide(null)
    setError('')
    client
      .neighbours({ source, word, k: 10 })
      .then((data) => {
        if (!cancelled) setWide(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [word, source, client])

  if (!word) return null

  const referenceIndex = scene?.points.findIndex((point) => point.word === word) ?? -1
  const neighbours = referenceIndex >= 0 && scene.matrix ? neighbourRanks(scene.points, scene.matrix, referenceIndex) : []
  const pair = neighbours.find((point) => point.word === comparison)
  const mismatch = [...neighbours].sort((left, right) =>
    Math.abs(right.vectorRank - right.mapRank) - Math.abs(left.vectorRank - left.mapRank),
  )[0]
  const ranked = order === 'vector' ? neighbours : [...neighbours].sort((left, right) => left.mapRank - right.mapRank)

  return (
    <div className="pair-inspector border-b border-paper-line">
      <header className="flex items-start justify-between gap-2 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <p className="inspector-eyebrow">The actual relationship</p>
          <h2 className="pair-title" title={word}>{word}</h2>
        </div>
        <span className="pair-dimensions">{sourceDims}D</span>
      </header>

      <div className="pair-comparison">
        <label htmlFor="comparison-word">Compared with</label>
        <select id="comparison-word" aria-label="Comparison word" value={comparison || ''} disabled={!neighbours.length} onChange={(event) => onCompare(event.target.value)}>
          {scene?.points.filter((point) => point.word !== word).map((point) => <option key={point.word}>{point.word}</option>)}
        </select>
      </div>

      {pair ? <>
        <PairAngle cosine={pair.similarity} reference={word} comparison={comparison} />
        <div className="pair-ranks">
          <span><strong>#{pair.vectorRank}</strong> vector rank</span>
          <span><strong>#{pair.mapRank}</strong> {method?.label || '3D'} rank</span>
        </div>
        <p className="pair-caveat">Cosine measures direction, not probability. Similar context can put opposites close together.</p>
      </> : null}

      <div className="neighbour-evidence">
        <div className="neighbour-heading">
          <h3>Collection neighbors</h3>
          <div className="ranking-order" role="group" aria-label="Neighbor ranking">
            <button type="button" aria-pressed={order === 'vector'} onClick={() => setOrder('vector')}>Vector</button>
            <button type="button" aria-pressed={order === 'map'} onClick={() => setOrder('map')}>3D map</button>
          </div>
        </div>
        <div className="neighbour-columns"><span>Word</span><span>Cosine</span><span>3D rank</span></div>
        {ranked.slice(0, 6).map((hit) => (
          <button key={hit.word} type="button" className={`neighbour-row ${hit.word === comparison ? 'is-selected' : ''}`} onClick={() => onCompare(hit.word)} title={`Compare ${word} with ${hit.word}`}>
            <span><small>{hit.vectorRank.toString().padStart(2, '0')}</small>{hit.word}</span>
            <span>{hit.similarity.toFixed(3)}</span>
            <span className={Math.abs(hit.vectorRank - hit.mapRank) > 3 ? 'rank-mismatch' : ''}>#{hit.mapRank}</span>
          </button>
        ))}
        {mismatch && mismatch.vectorRank !== mismatch.mapRank ? <button type="button" className="mismatch-button" onClick={() => onCompare(mismatch.word)}>
          <ScanSearch size={14} /> Largest rank mismatch <span>{Math.abs(mismatch.vectorRank - mismatch.mapRank)} places</span>
        </button> : null}
      </div>

      <details className="vocabulary-details">
        <summary>Beyond this collection</summary>
        <div className="px-4 pb-3.5">
        {wide?.pool ? (
          <p className="mb-2 text-[10.5px] leading-[1.4] text-ink-mute">
            Searched {wide.pool}.
          </p>
        ) : null}
        {error ? (
          <p className="text-[11px] leading-[1.45] text-ink-soft">{error}</p>
        ) : !wide ? (
          <p className="text-[11px] text-ink-mute">Looking…</p>
        ) : (
          <ul className="space-y-1">
            {wide.neighbours.map((hit) => (
              <li key={hit.word} className="flex items-baseline justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onAdd(hit.word)}
                  disabled={!client.capabilities.canEmbed}
                  title={client.capabilities.canEmbed ? `Add ${hit.word} to the scene` : 'A live model is required to add words'}
                  className="min-w-0 truncate text-left font-mono text-[11.5px] text-ink underline decoration-paper-line underline-offset-2 hover:text-signal hover:decoration-signal"
                >
                  {hit.word}
                </button>
                <span className="tnum shrink-0 text-[11.5px] text-ink-soft">
                  {sim(hit.similarity)}
                </span>
              </li>
            ))}
          </ul>
        )}
        </div>
      </details>
    </div>
  )
}

function PairAngle({ cosine, reference, comparison }) {
  const angle = cosineAngle(cosine)
  const sine = Math.sqrt(Math.max(0, 1 - cosine ** 2))

  return (
    <div className="pair-angle">
      <div className="pair-statistics">
        <div><span>Cosine similarity</span><strong data-testid="pair-cosine">{cosine.toFixed(3)}</strong></div>
        <div><span>Angle between vectors</span><strong data-testid="pair-angle">{angle.toFixed(1)}<small>&deg;</small></strong></div>
      </div>
      <svg viewBox="0 0 280 188" role="img" aria-label={`${reference} and ${comparison}: ${angle.toFixed(1)} degrees apart in the original embedding space`}>
        <path d="M 42 145 A 98 98 0 0 1 238 145" fill="none" stroke="#c1c9bd" strokeDasharray="3 5" />
        <line x1="28" y1="145" x2="254" y2="145" stroke="#b4bfaf" />
        <line x1="140" y1="38" x2="140" y2="145" stroke="#c1c9bd" strokeDasharray="3 5" />
        <line x1="140" y1="145" x2="238" y2="145" stroke="#167356" strokeWidth="2.5" />
        <line x1="140" y1="145" x2={140 + cosine * 98} y2={145 - sine * 98} stroke="#af582b" strokeWidth="2.5" />
        <line x1={140 + cosine * 98} y1={145 - sine * 98} x2={140 + cosine * 98} y2="145" stroke="#af582b" strokeDasharray="3 4" />
        <path d={`M 174 145 A 34 34 0 0 0 ${140 + cosine * 34} ${145 - sine * 34}`} fill="none" stroke="#167356" />
        <circle cx="140" cy="145" r="3" fill="#4e6047" />
        <circle cx="238" cy="145" r="5" fill="#167356" />
        <circle cx={140 + cosine * 98} cy={145 - sine * 98} r="5" fill="#af582b" />
        <text x="42" y="166" textAnchor="middle">-1</text>
        <text x="140" y="166" textAnchor="middle">0</text>
        <text x="238" y="166" textAnchor="middle">+1</text>
        <text x="140" y="183" textAnchor="middle">unit-vector projection</text>
      </svg>
      <div className="pair-key"><span title={reference}><i />{reference}</span><span title={comparison}><i />{comparison}</span></div>
    </div>
  )
}
