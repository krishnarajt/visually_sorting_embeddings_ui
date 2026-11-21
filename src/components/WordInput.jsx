import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { parseWords } from '../lib/format'

/**
 * The word list.
 *
 * Words are added on Enter rather than on every keystroke. Per-keystroke
 * embedding would bill an API call for "quee" on the way to "queen" and
 * re-run the whole layout three times while someone is mid-word — and since
 * t-SNE and UMAP recompute from scratch, the cloud would thrash. Enter is the
 * commit.
 */
export default function WordInput({ words, onChange, disabled, disabledReason, supportsPhrases, missing }) {
  const [draft, setDraft] = useState('')
  const missingSet = new Set(missing || [])

  function commit() {
    const added = parseWords(draft)
    if (!added.length) return
    const next = [...words]
    added.forEach((word) => {
      if (!next.includes(word)) next.push(word)
    })
    onChange(next)
    setDraft('')
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
          placeholder={supportsPhrases ? 'a word, or a whole sentence' : 'one word at a time'}
          aria-label="Add a word"
          className="min-w-0 flex-1 rounded-[3px] border border-paper-line bg-white/70 px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-signal disabled:cursor-not-allowed disabled:bg-paper-sunk disabled:text-ink-mute"
        />
        <button
          type="button"
          onClick={commit}
          disabled={disabled || !draft.trim()}
          aria-label="Add word"
          className="shrink-0 rounded-[3px] border border-paper-line bg-paper-sunk px-2 text-ink transition-colors hover:border-ink-mute disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>

      {disabled ? (
        <p className="mt-2 text-[11px] leading-snug text-ink-soft">{disabledReason}</p>
      ) : null}

      {words.length ? (
        <ul className="rail-scroll mt-2.5 flex max-h-[168px] flex-wrap gap-1 overflow-y-auto">
          {words.map((word) => {
            const isMissing = missingSet.has(word)
            return (
              <li key={word}>
                <span
                  className={[
                    'inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-[3px] font-mono text-[11px]',
                    isMissing
                      ? 'border-dashed border-ink-mute bg-transparent text-ink-mute'
                      : 'border-paper-line bg-white/70 text-ink',
                  ].join(' ')}
                  title={isMissing ? 'This model has no vector for this word' : undefined}
                >
                  {word}
                  <button
                    type="button"
                    onClick={() => onChange(words.filter((w) => w !== word))}
                    aria-label={`Remove ${word}`}
                    className="text-ink-mute hover:text-ink"
                  >
                    <X size={11} />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="mt-2 flex items-center justify-between">
        <span className="tnum text-[10.5px] text-ink-mute">{words.length} on screen</span>
        {words.length ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10.5px] text-ink-soft underline decoration-paper-line underline-offset-2 hover:text-ink"
          >
            Clear all
          </button>
        ) : null}
      </div>
    </div>
  )
}
