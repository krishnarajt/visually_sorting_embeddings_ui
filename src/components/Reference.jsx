import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useGlossary } from '../lib/glossary'

/**
 * Every term the app uses, with the long explanation.
 *
 * The counterpart to the inline `<Term>` buttons: those give one sentence
 * where the number is, this gives the paragraph that says why the number is
 * worth having and how it misleads — which is usually the more useful half and
 * never fits beside a figure.
 *
 * Grouped by topic in the order the backend defines them, which runs from the
 * vectors themselves outward to the word sets. Not alphabetical: nobody looks
 * up "stress" by its initial letter, and alphabetical order would put
 * "cohesion" between "cluster" and "collapse" while separating the two
 * projection-quality measures that only make sense read together.
 */
export default function Reference() {
  const { terms, topics } = useGlossary()
  const [query, setQuery] = useState('')

  const all = useMemo(() => Array.from(terms.values()), [terms])
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return all
    return all.filter((term) =>
      `${term.label} ${term.short} ${term.detail}`.toLowerCase().includes(needle),
    )
  }, [all, query])

  if (!all.length) {
    return (
      <p className="text-[11px] leading-[1.45] text-ink-soft">
        The reference list comes from the backend with everything else. This
        build of the offline bundle predates it — regenerate it with
        scripts/export_demo.py.
      </p>
    )
  }

  const grouped = topics
    .map((topic) => ({ topic, items: matching.filter((term) => term.topic === topic) }))
    .filter((group) => group.items.length)
  const loose = matching.filter((term) => !term.topic)

  return (
    <div>
      <label className="mb-2.5 flex items-center gap-1.5 rounded-[3px] border border-paper-line bg-paper-sunk/60 px-2 py-1">
        <Search size={11} className="shrink-0 text-ink-mute" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a term"
          className="min-w-0 flex-1 bg-transparent text-[11px] text-ink placeholder:text-ink-mute focus:outline-none"
        />
      </label>

      {!matching.length ? (
        <p className="text-[11px] text-ink-soft">
          Nothing matches “{query}”.
        </p>
      ) : null}

      {[...grouped, ...(loose.length ? [{ topic: 'Other', items: loose }] : [])].map(
        (group) => (
          <section key={group.topic} className="mb-3 last:mb-0">
            <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-mute">
              {group.topic}
            </h3>
            <dl className="space-y-2">
              {group.items.map((term) => (
                <div key={term.id}>
                  <dt className="text-[11.5px] font-medium text-ink">{term.label}</dt>
                  <dd className="mt-0.5 text-[10.5px] leading-[1.5] text-ink-soft">
                    {term.short}
                    {term.detail ? (
                      <span className="mt-1 block text-ink-mute">{term.detail}</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ),
      )}
    </div>
  )
}
