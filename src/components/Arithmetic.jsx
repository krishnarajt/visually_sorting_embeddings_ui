import { Equal, Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'

import { sim } from '../lib/format'

/**
 * king − man + woman.
 *
 * The famous result, and the honest version of it. Three things this panel
 * insists on:
 *
 * 1. The pool it searched is printed with the answer. On GloVe it is fifty
 *    thousand words, which makes "queen" a real finding; on the OpenAI sources
 *    it is only what you have indexed, which makes it a much weaker claim, and
 *    the user should not have to guess which they are looking at.
 * 2. Each input term's similarity to the result is shown. Analogies usually
 *    "fail" by staying closest to the term they started from, and seeing
 *    similarity(result, king) = 0.81 explains the answer better than the answer.
 * 3. The expected word is named, so a miss is visible as a miss. A tool that
 *    only showed successes would be a demo, not an instrument.
 */
export default function Arithmetic({ analogies, source, client, onAdd, goodAtAnalogies }) {
  const [terms, setTerms] = useState([])
  const [draft, setDraft] = useState('')
  const [result, setResult] = useState(null)
  const [expect, setExpect] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(nextTerms, expectWord = '') {
    if (!nextTerms.length) return
    setBusy(true)
    setError('')
    setExpect(expectWord)
    try {
      const data = await client.arithmetic({
        source,
        terms: nextTerms.map((t) => [t.word, t.sign]),
        topk: 8,
      })
      setResult(data)
    } catch (err) {
      setResult(null)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function loadAnalogy(analogy) {
    const next = analogy.terms.map((t) => ({ word: t.word, sign: t.sign }))
    setTerms(next)
    run(next, analogy.expect)
  }

  function addTerm(sign) {
    const word = draft.trim().toLowerCase()
    if (!word) return
    const next = [...terms, { word, sign }]
    setTerms(next)
    setDraft('')
    run(next)
  }

  const hit = result?.result?.[0]?.word
  const matched = expect && hit === expect

  return (
    <div>
      {!goodAtAnalogies ? (
        <p className="mb-2.5 rounded-[3px] border border-paper-line bg-paper-sunk/70 px-2 py-1.5 text-[10.5px] leading-[1.45] text-ink-soft">
          This model is a sentence encoder, not word2vec. Offset arithmetic is much
          weaker on it — switch to GloVe for the version that works.
        </p>
      ) : null}

      <div className="mb-2 flex flex-wrap gap-1">
        {analogies.map((analogy) => (
          <button
            key={analogy.label}
            type="button"
            onClick={() => loadAnalogy(analogy)}
            className="rounded-[3px] border border-paper-line bg-white/60 px-1.5 py-[3px] font-mono text-[10.5px] text-ink transition-colors hover:border-signal hover:text-signal"
          >
            {analogy.label}
          </button>
        ))}
      </div>

      {terms.length ? (
        <div className="mb-2 flex flex-wrap items-center gap-1 rounded-[3px] border border-paper-line bg-white/60 px-2 py-1.5">
          {terms.map((term, i) => (
            <span key={`${term.word}-${i}`} className="flex items-center gap-0.5">
              {i > 0 || term.sign < 0 ? (
                <span className="text-ink-soft">
                  {term.sign < 0 ? <Minus size={11} /> : <Plus size={11} />}
                </span>
              ) : null}
              <span className="font-mono text-[11.5px] text-ink">{term.word}</span>
              <button
                type="button"
                onClick={() => {
                  const next = terms.filter((_, j) => j !== i)
                  setTerms(next)
                  if (next.length) run(next, expect)
                  else setResult(null)
                }}
                aria-label={`Remove ${term.word}`}
                className="text-ink-mute hover:text-ink"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <Equal size={11} className="ml-0.5 text-ink-mute" />
        </div>
      ) : null}

      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addTerm(1)
            }
          }}
          placeholder="a word to add or subtract"
          aria-label="Term for vector arithmetic"
          className="min-w-0 flex-1 rounded-[3px] border border-paper-line bg-white/70 px-2 py-1.5 font-mono text-[11.5px] text-ink outline-none focus:border-signal"
        />
        <button
          type="button"
          onClick={() => addTerm(1)}
          disabled={!draft.trim()}
          aria-label="Add this word"
          className="shrink-0 rounded-[3px] border border-paper-line bg-paper-sunk px-1.5 text-ink hover:border-ink-mute disabled:opacity-40"
        >
          <Plus size={13} />
        </button>
        <button
          type="button"
          onClick={() => addTerm(-1)}
          disabled={!draft.trim()}
          aria-label="Subtract this word"
          className="shrink-0 rounded-[3px] border border-paper-line bg-paper-sunk px-1.5 text-ink hover:border-ink-mute disabled:opacity-40"
        >
          <Minus size={13} />
        </button>
      </div>

      {busy ? <p className="mt-2 text-[11px] text-ink-mute">Working…</p> : null}
      {error ? <p className="mt-2 text-[11px] leading-[1.45] text-ink-soft">{error}</p> : null}

      {result?.result?.length ? (
        <div className="mt-2.5">
          {expect ? (
            <p className="mb-1.5 text-[11px] leading-[1.4] text-ink-soft">
              Expected <span className="font-mono text-ink">{expect}</span> —{' '}
              {matched ? (
                <span className="text-ink">it came first.</span>
              ) : (
                <span className="text-ink">
                  it did not come first. That is the model, not a bug.
                </span>
              )}
            </p>
          ) : null}
          <ul className="space-y-1">
            {result.result.map((hitRow, i) => (
              <li key={hitRow.word} className="flex items-baseline justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onAdd(hitRow.word)}
                  title={`Add ${hitRow.word} to the scene`}
                  className={[
                    'min-w-0 truncate text-left font-mono text-[11.5px] underline decoration-paper-line underline-offset-2 hover:text-signal hover:decoration-signal',
                    i === 0 ? 'font-medium text-ink' : 'text-ink-soft',
                  ].join(' ')}
                >
                  {hitRow.word}
                </button>
                <span className="tnum shrink-0 text-[11.5px] text-ink-soft">
                  {sim(hitRow.similarity)}
                </span>
              </li>
            ))}
          </ul>

          {result.terms?.length ? (
            <div className="mt-2.5 border-t border-paper-line pt-2">
              <p className="mb-1 text-[10.5px] text-ink-mute">
                How much of each input survives in the answer:
              </p>
              <ul className="space-y-0.5">
                {result.terms.map((term) => (
                  <li key={term.word} className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink-soft">
                      {term.sign < 0 ? '−' : '+'} {term.word}
                    </span>
                    <span className="tnum text-[11px] text-ink-soft">
                      {sim(term.similarity_to_result)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.pool ? (
            <p className="mt-2 text-[10.5px] leading-[1.4] text-ink-mute">
              Searched {result.pool}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
