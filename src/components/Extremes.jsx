import { sim } from '../lib/format'

/**
 * The most and least similar pairs on screen.
 *
 * A forty-word matrix holds 780 numbers and nobody reads a matrix. The
 * extremes are where the interesting cases are: the pair that surprises you,
 * and the pair that ought to be opposites and is not. Both lists are
 * full-dimensional, so they are also a check on the view — if the closest pair
 * in the model is not close on screen, the layout is telling you a story.
 */
export default function Extremes({ pairs, onFocus, limit = 6 }) {
  if (!pairs?.length) return null
  const sorted = [...pairs].sort((a, b) => b.similarity - a.similarity)
  const closest = sorted.slice(0, limit)
  const furthest = sorted.slice(-limit).reverse()

  function Row({ pair }) {
    return (
      <li className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[11px] text-ink-soft">
          <button
            type="button"
            onClick={() => onFocus(pair.a)}
            className="hover:text-signal hover:underline"
          >
            {pair.a}
          </button>
          <span className="text-ink-mute"> · </span>
          <button
            type="button"
            onClick={() => onFocus(pair.b)}
            className="hover:text-signal hover:underline"
          >
            {pair.b}
          </button>
        </span>
        <span className="tnum shrink-0 text-[11px] text-ink">{sim(pair.similarity)}</span>
      </li>
    )
  }

  return (
    <div className="grid gap-3">
      <div>
        <h3 className="mb-1.5 font-display text-[12px] font-semibold text-ink">Closest pairs</h3>
        <ul className="space-y-0.5">
          {closest.map((pair) => (
            <Row key={`${pair.a}-${pair.b}`} pair={pair} />
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1.5 font-display text-[12px] font-semibold text-ink">
          Furthest apart
        </h3>
        <ul className="space-y-0.5">
          {furthest.map((pair) => (
            <Row key={`${pair.a}-${pair.b}`} pair={pair} />
          ))}
        </ul>
      </div>
    </div>
  )
}
