import { useMemo, useState } from 'react'

import { sim } from '../lib/format'
import { SEQUENTIAL, similarityColour } from '../lib/palette'

/**
 * The similarity matrix — every pair, with no projection in the way.
 *
 * This is the control for the whole visualisation. The 3-D view is an
 * approximation of these numbers; this is the numbers. When a pair looks close
 * in the view, the cell is where you check.
 *
 * On the same sequential blue as the point cloud, for one reason: the user has
 * already learned "darker blue means more similar" from the view, and a
 * diverging red/blue scale here would teach them a second, conflicting
 * association for the same quantity three inches away. Cosine runs to -1 in
 * principle, but under 2% of real pairs are negative and none by much, so the
 * ramp starts at 0 rather than spending half its range on an empty case.
 */
export default function Matrix({ words, matrix, focus, onFocus, onHover }) {
  const [cell, setCell] = useState(null)

  // Ordering by similarity to the focused word turns the matrix from a lookup
  // table into a ranking, which is the form the question usually takes.
  const order = useMemo(() => {
    const base = words.map((_, i) => i)
    if (!focus) return base
    const pivot = words.indexOf(focus)
    if (pivot < 0) return base
    return base.sort((a, b) => matrix[pivot][b] - matrix[pivot][a])
  }, [words, matrix, focus])

  if (!words?.length || !matrix?.length) return null

  const size = Math.max(5, Math.min(15, Math.floor(232 / words.length)))

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] leading-[1.4] text-ink-soft">
          {focus ? (
            <>
              Rows and columns sorted by similarity to{' '}
              <span className="font-mono text-ink">{focus}</span>.
            </>
          ) : (
            'Every pair, in the order you added them. Select a word to sort by it.'
          )}
        </p>
      </div>

      <div
        className="mt-2 inline-grid gap-px"
        style={{ gridTemplateColumns: `repeat(${words.length}, ${size}px)` }}
        role="img"
        aria-label={`Cosine similarity matrix for ${words.length} words`}
        onMouseLeave={() => {
          setCell(null)
          onHover(null)
        }}
      >
        {order.map((row) =>
          order.map((col) => {
            const value = matrix[row][col]
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                tabIndex={-1}
                onMouseEnter={() => {
                  setCell({ a: words[row], b: words[col], value })
                  onHover(words[row])
                }}
                onClick={() => onFocus(words[row])}
                style={{
                  background: row === col ? '#1a1a19' : similarityColour(value),
                  width: size,
                  height: size,
                }}
                /* The diagonal is every word against itself — always 1.00 and
                   always meaningless. Painted as the surface colour so it
                   reads as a divider rather than as the strongest signal in
                   the chart, which is what the darkest ramp step would say. */
                title={`${words[row]} · ${words[col]} = ${sim(value)}`}
              />
            )
          }),
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-2.5 w-24 overflow-hidden rounded-[2px]">
          {SEQUENTIAL.map((colour) => (
            <div key={colour} className="flex-1" style={{ background: colour }} />
          ))}
        </div>
        <span className="tnum text-[10px] text-ink-mute">0.00 → 1.00</span>
      </div>

      <p className="tnum mt-2 h-4 text-[11px] text-ink">
        {cell ? (
          cell.a === cell.b ? (
            <span className="text-ink-mute">{cell.a} against itself</span>
          ) : (
            <>
              {cell.a} · {cell.b} = {sim(cell.value)}
            </>
          )
        ) : (
          ''
        )}
      </p>
    </div>
  )
}
