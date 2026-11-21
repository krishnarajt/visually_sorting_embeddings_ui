import { AlertCircle, ArrowRight, Languages, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Does this model sort by meaning or by language, and would translating first
 * have been better?
 *
 * Only appears for the concept-by-language word sets, because it is the only
 * place the question is well posed: those words carry a concept and a language
 * each, and without both labels there is nothing to compare. Everything here
 * is measured on the full vectors by the backend, so none of it moves when the
 * projection method changes — which is exactly why it is worth having beside a
 * picture that does.
 *
 * Four numbers rather than one, on purpose. Retrieval accuracy alone flatters
 * multilingual-e5-small, which ranks every translation first while putting all
 * 48 words above 0.85 of each other; the margin alone punishes any model with
 * a compressed cosine range for no reason a user would care about. The
 * backend's docstring in app/services/alignment.py has the argument in full.
 */

/** A percentage, or an em dash where the backend sent null. */
function pct(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`
}

function signed(value) {
  if (value === null || value === undefined) return '—'
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(3)}`
}

function Metric({ label, value, hint, emphasis }) {
  return (
    <div className="border-t border-paper-line pt-1.5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-ink-soft">{label}</span>
        <span
          className={[
            'tnum shrink-0 text-[12px]',
            emphasis ? 'font-semibold text-ink' : 'text-ink',
          ].join(' ')}
        >
          {value}
        </span>
      </div>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-[1.4] text-ink-mute">{hint}</p>
      ) : null}
    </div>
  )
}

/** The one-line verdict: which label does the geometry actually agree with. */
function Sorts({ report }) {
  const byConcept = report.silhouette_by_concept
  const byLanguage = report.silhouette_by_language
  if (byConcept === null || byLanguage === null) return null
  const meaningWins = byConcept > byLanguage
  return (
    <p
      className={[
        'rounded-[3px] border px-2 py-1.5 text-[11px] leading-[1.45]',
        meaningWins
          ? 'border-signal/40 bg-signal/10 text-ink'
          : 'border-paper-line bg-paper-sunk text-ink',
      ].join(' ')}
    >
      {meaningWins ? (
        <>
          Sorted by <strong>meaning</strong>. Clustering these words by concept
          agrees with the vectors ({signed(byConcept)}) better than clustering
          them by language does ({signed(byLanguage)}).
        </>
      ) : (
        <>
          Sorted by <strong>language</strong>. Grouping by language fits the
          vectors ({signed(byLanguage)}) better than grouping by meaning
          ({signed(byConcept)}) — a negative score by concept means the clusters
          are real and "concept" is the wrong name for them.
        </>
      )}
    </p>
  )
}

function Report({ report }) {
  if (!report?.measurable) {
    return (
      <p className="flex items-start gap-1.5 text-[11px] leading-[1.45] text-ink-soft">
        <AlertCircle size={11} className="mt-[2px] shrink-0" />
        {report?.reason || 'Not enough of this word set could be embedded to measure.'}
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <Sorts report={report} />
      <div className="space-y-1.5">
        <Metric
          label="Translation found"
          value={pct(report.translation_p_at_1)}
          emphasis
          hint={`Of the ${report.words} words, how often the nearest word in another language is its own translation.`}
        />
        <Metric
          label="Meaning beats language"
          value={pct(report.meaning_beats_language)}
          hint="Every translation pair against every same-language pair. 50% is a coin flip."
        />
        <Metric
          label="Margin"
          value={signed(report.gap)}
          hint={`Same meaning ${signed(report.mean_same_concept)} minus same language ${signed(report.mean_same_language)}. Near zero means the ranking is right and the numbers are uninformative.`}
        />
      </div>

      {report.collapsed_concepts?.length ? (
        <p className="rounded-[3px] border border-paper-line bg-paper-sunk px-2 py-1.5 text-[10.5px] leading-[1.45] text-ink-soft">
          {report.collapsed_concepts.length} concept
          {report.collapsed_concepts.length === 1 ? '' : 's'} came out as one
          identical string, so the index holds one vector where the word set has
          several. The scores above are arithmetic on those concepts, not skill.
        </p>
      ) : null}

      {report.by_concept?.length ? (
        <div>
          <p className="mb-1 text-[10.5px] text-ink-mute">
            Loosest concepts across languages
          </p>
          <ul className="space-y-0.5">
            {report.by_concept.slice(0, 3).map((row) => (
              <li
                key={row.concept}
                className="flex items-baseline justify-between gap-2 text-[11px]"
              >
                <span className="font-mono text-ink">{row.concept}</span>
                <span className="tnum text-ink-soft">{signed(row.cohesion)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.confusions?.length ? (
        <div>
          <p className="mb-1 text-[10.5px] text-ink-mute">
            Retrieved the wrong word
          </p>
          <ul className="space-y-1">
            {report.confusions.slice(0, 4).map((row) => (
              <li key={row.word} className="text-[10.5px] leading-[1.4]">
                <span className="font-mono text-ink">{row.word}</span>
                <span className="text-ink-mute"> reached for </span>
                <span className="font-mono text-ink">{row.retrieved}</span>
                <span className="tnum text-ink-mute"> {row.similarity.toFixed(3)}</span>
                {row.best_translation ? (
                  <>
                    <span className="text-ink-mute">, over </span>
                    <span className="font-mono text-ink">{row.best_translation}</span>
                    <span className="tnum text-ink-mute">
                      {' '}
                      {row.best_translation_similarity.toFixed(3)}
                    </span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** Native versus translate-to-English, and which index actually won. */
function Pivot({ data }) {
  const { comparison, native, pivot } = data
  const rows = [
    ['Translation found', native.translation_p_at_1, pivot.translation_p_at_1, pct],
    ['Meaning beats language', native.meaning_beats_language, pivot.meaning_beats_language, pct],
    ['Margin', native.gap, pivot.gap, signed],
  ]
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1">
        <span />
        <span className="text-right text-[10px] text-ink-mute">as written</span>
        <span className="text-right text-[10px] text-ink-mute">translated</span>
        {rows.map(([label, a, b, format]) => (
          <div key={label} className="contents">
            <span className="text-[11px] text-ink-soft">{label}</span>
            <span className="tnum text-right text-[11.5px] text-ink">{format(a)}</span>
            <span className="tnum text-right text-[11.5px] text-ink">{format(b)}</span>
          </div>
        ))}
      </div>

      <p className="rounded-[3px] border border-paper-line bg-paper-sunk px-2 py-1.5 text-[11px] leading-[1.45] text-ink">
        <span className="font-semibold">
          {comparison.verdict === 'tie'
            ? 'No difference'
            : comparison.verdict === 'incomparable'
              ? 'Not comparable'
              : `${comparison.verdict} wins`}
        </span>
        {comparison.decided_on ? (
          <span className="text-ink-soft"> — decided on {comparison.decided_on}.</span>
        ) : null}
        {comparison.note ? (
          <span className="mt-1 block text-[10.5px] leading-[1.45] text-ink-soft">
            {comparison.note}
          </span>
        ) : null}
      </p>
    </div>
  )
}

export default function Alignment({ client, source, lexicon, canPivot }) {
  const [tab, setTab] = useState('model')
  const [report, setReport] = useState(null)
  const [pivot, setPivot] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Keyed on (source, lexicon) rather than fetched once: the whole point is
  // that these numbers differ between models, so a stale one under a new
  // model's name would be the most convincing kind of wrong.
  useEffect(() => {
    if (!client || !source || !lexicon) return
    let cancelled = false
    setBusy(true)
    setError('')
    setReport(null)
    setPivot(null)
    const wanted = tab === 'pivot' && canPivot
    const request = wanted
      ? client.pivot({ source, lexicon })
      : client.alignment({ source, lexicon })
    request
      .then((data) => {
        if (cancelled) return
        if (wanted) setPivot(data)
        else setReport(data.report)
      })
      .catch((exc) => {
        if (!cancelled) setError(exc.message)
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [client, source, lexicon, tab, canPivot])

  return (
    <div>
      <div className="mb-2.5 flex gap-1">
        {[
          ['model', 'this model'],
          ['pivot', 'vs translating'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            disabled={id === 'pivot' && !canPivot}
            onClick={() => setTab(id)}
            className={[
              'flex-1 rounded-[3px] border px-1.5 py-1 text-[10.5px] transition-colors',
              tab === id
                ? 'border-signal bg-signal/10 text-ink'
                : 'border-paper-line bg-paper-sunk/60 text-ink-soft hover:border-ink-mute',
              id === 'pivot' && !canPivot ? 'cursor-not-allowed opacity-50' : '',
            ].join(' ')}
            title={
              id === 'pivot' && !canPivot
                ? 'Already looking at the translated index — switch back to compare'
                : undefined
            }
          >
            {label}
          </button>
        ))}
      </div>

      {busy ? (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
          <Loader2 size={11} className="animate-spin" />
          measuring…
        </p>
      ) : error ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-[1.45] text-ink-soft">
          <AlertCircle size={11} className="mt-[2px] shrink-0" />
          {error}
        </p>
      ) : tab === 'pivot' && pivot ? (
        <Pivot data={pivot} />
      ) : report ? (
        <Report report={report} />
      ) : null}

      <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-[1.4] text-ink-mute">
        <Languages size={10} className="mt-[2px] shrink-0" />
        Measured on the full vectors, so changing the projection method below
        does not move any of these. Switch the colouring to{' '}
        <span className="whitespace-nowrap">by language</span>
        <ArrowRight size={9} className="mt-[3px] inline shrink-0" />
        <span className="whitespace-nowrap">by meaning</span> to see the same
        thing in the view.
      </p>
    </div>
  )
}
