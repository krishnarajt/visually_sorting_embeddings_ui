import { num, pct, readDistance, readTrust } from '../lib/format'

/**
 * A 0-1 metric as a meter.
 *
 * The bar exists because "0.72" has no scale attached and the whole job of
 * these two numbers is to be compared — against each other, against the same
 * method on different words, and against the other methods on the strip below
 * the viewport. A filled track makes that comparison pre-attentive; the digits
 * are there for when it matters exactly.
 */
function Meter({ label, value, reading, explain }) {
  const filled = value === null || value === undefined ? 0 : Math.max(0, Math.min(1, value))
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-ink">{label}</span>
        <span className="tnum text-[12px] font-medium text-ink">
          {value === null || value === undefined ? '—' : num(value, 2)}
        </span>
      </div>
      <div
        className="mt-1 h-[5px] w-full overflow-hidden rounded-full bg-paper-sunk"
        role="meter"
        aria-valuenow={filled}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-signal" style={{ width: `${filled * 100}%` }} />
      </div>
      {reading ? (
        <p className="mt-1 text-[11px] leading-[1.4] text-ink-soft">{reading}</p>
      ) : null}
      {explain ? <p className="mt-1 text-[10.5px] leading-[1.4] text-ink-mute">{explain}</p> : null}
    </div>
  )
}

/**
 * How much the flattening cost, in two numbers.
 *
 * These are the reason the app can be trusted. Both are measured between the
 * full-dimensional vectors and the three coordinates on screen, so they say
 * what the picture got wrong. Read together they identify the method: high
 * trust with low distance correlation is t-SNE's signature — the right
 * neighbours in the wrong places — and it is the single most misread property
 * of these plots.
 */
export default function MetricPanel({ meta, method, sourceDims }) {
  if (!meta) return null
  const trust = meta.trustworthiness
  const distance = meta.distance_correlation

  const extras = []
  if (meta.explained_variance_total !== undefined) {
    extras.push({
      label: 'Variance retained',
      value: pct(meta.explained_variance_total),
      note: `Three axes out of ${sourceDims}. The rest of what separates these words is not on the screen.`,
    })
  }
  if (meta.stress !== undefined) {
    extras.push({
      label: 'Stress',
      value: num(meta.stress, 3),
      note:
        meta.stress < 0.1
          ? 'Under 0.1 — the distances you see are close to the real ones.'
          : meta.stress < 0.2
            ? 'Between 0.1 and 0.2 — distances are indicative, not measurable.'
            : 'Over 0.2 — the true geometry does not fit in three dimensions, and this is the residual.',
    })
  }
  if (meta.kl_divergence !== undefined) {
    extras.push({
      label: 'KL divergence',
      value: num(meta.kl_divergence, 3),
      note: 'What t-SNE was minimising. Lower is a better fit to the neighbourhood probabilities.',
    })
  }
  if (meta.perplexity !== undefined) {
    extras.push({ label: 'Perplexity used', value: num(meta.perplexity, 1), note: '' })
  }
  if (meta.n_neighbors !== undefined) {
    extras.push({ label: 'Neighbours used', value: String(meta.n_neighbors), note: '' })
  }
  if (meta.dims !== undefined) {
    extras.push({
      label: 'Dimensions shown',
      value: meta.dims.join(', '),
      note: `Three of ${meta.of}, picked by index and no more meaningful than any other three.`,
    })
  }

  return (
    <div>
      <Meter
        label="Neighbours preserved"
        value={trust}
        reading={readTrust(trust)}
        explain={
          meta.trustworthiness_k
            ? `Of each word's ${meta.trustworthiness_k} nearest neighbours on screen, how many were genuinely among its ${meta.trustworthiness_k} nearest in full dimensions.`
            : 'Needs at least six words to compute.'
        }
      />
      <Meter
        label="Distances preserved"
        value={distance}
        reading={readDistance(distance)}
        explain="Rank correlation between every true cosine distance and the distance drawn between the same two points."
      />

      {extras.length ? (
        <dl className="mt-3 border-t border-paper-line pt-2.5">
          {extras.map((extra) => (
            <div key={extra.label} className="mb-2 last:mb-0">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[11.5px] text-ink-soft">{extra.label}</dt>
                <dd className="tnum text-[12px] font-medium text-ink">{extra.value}</dd>
              </div>
              {extra.note ? (
                <p className="mt-0.5 text-[10.5px] leading-[1.4] text-ink-mute">{extra.note}</p>
              ) : null}
            </div>
          ))}
        </dl>
      ) : null}

      {method?.detail ? (
        <p className="mt-3 border-t border-paper-line pt-2.5 text-[11.5px] leading-[1.5] text-ink-soft">
          {method.detail}
        </p>
      ) : null}
    </div>
  )
}
