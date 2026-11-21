import { Check, Languages, Lock } from 'lucide-react'

import { count } from '../lib/format'

/**
 * Which model's vectors to look at, and whether to translate first.
 *
 * Presented as rows rather than a dropdown because the differences between
 * them — dimensionality, whether phrases work, whether the arithmetic works,
 * and above all how each one came by its multilingual ability — are the
 * substance of the comparison, not a setting to be tucked away. An unavailable
 * source stays visible with its reason attached; hiding it would leave the
 * user wondering why the thing they read about is missing.
 *
 * The rows are the eight models. The switch underneath picks between a model
 * and its translate-to-English twin, which the API exposes as sixteen separate
 * sources — sixteen rows of which half were the same eight labels again read as
 * clutter, and the twin is a property of the index rather than a different
 * model.
 */

/** How the model came by its cross-lingual ability, in one word. */
const ORIGIN = {
  none: { label: 'one language', tone: 'text-ink-mute' },
  incidental: { label: 'English only', tone: 'text-ink-mute' },
  multilingual: { label: 'multilingual', tone: 'text-ink-soft' },
  aligned: { label: 'translation-trained', tone: 'text-signal' },
  pivot: { label: 'translated first', tone: 'text-signal' },
}

export default function SourcePicker({ sources, value, onChange }) {
  // Only the native models get a row; the twins are reached by the switch.
  const natives = sources.filter((source) => !source.pivot)
  const selected = sources.find((source) => source.id === value)
  const base = selected?.base || selected?.id || ''
  const twin = sources.find((source) => source.base === base)
  const translated = Boolean(selected?.pivot)

  return (
    <div className="space-y-1.5">
      {natives.map((source) => {
        const active = source.id === base
        const disabled = !source.available
        const origin = ORIGIN[source.cross_lingual] || ORIGIN.none
        return (
          <button
            key={source.id}
            type="button"
            disabled={disabled}
            // Keep whichever index the user was already looking at, so
            // flipping between models while comparing does not silently reset
            // the comparison.
            onClick={() => onChange(translated ? `${source.id}-via-en` : source.id)}
            aria-pressed={active}
            className={[
              'w-full rounded-[3px] border px-2.5 py-2 text-left transition-colors',
              active
                ? 'border-signal bg-signal/10'
                : 'border-paper-line bg-paper-sunk/60 hover:border-ink-mute',
              disabled ? 'cursor-not-allowed opacity-55' : '',
            ].join(' ')}
          >
            <div className="flex items-start gap-2">
              <span className="mt-[3px] shrink-0">
                {disabled ? (
                  <Lock size={12} className="text-ink-mute" />
                ) : (
                  <Check
                    size={12}
                    className={active ? 'text-signal' : 'text-transparent'}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium leading-tight text-ink">
                  {source.label}
                </span>
                <span className="tnum mt-0.5 block text-[10.5px] text-ink-mute">
                  {count(source.dims)} dimensions
                  {source.languages > 1 ? ` · ${source.languages} languages` : ''}
                  {source.vocab_size ? ` · ${count(source.vocab_size)} words on disk` : ''}
                  {source.indexed ? ` · ${count(source.indexed)} embedded` : ''}
                </span>
                <span className={`mt-0.5 block text-[10px] ${origin.tone}`}>
                  {origin.label}
                </span>
                {disabled ? (
                  <span className="mt-1 block text-[10.5px] leading-snug text-ink-soft">
                    Unavailable — {source.unavailable_reason}
                  </span>
                ) : null}
              </span>
            </div>
          </button>
        )
      })}

      {twin?.available ? (
        <div className="pt-1">
          <div className="flex gap-1">
            {[
              [false, 'embed as written'],
              [true, 'translate to English'],
            ].map(([wanted, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={translated === wanted}
                onClick={() => onChange(wanted ? `${base}-via-en` : base)}
                className={[
                  'flex-1 rounded-[3px] border px-1.5 py-1 text-[10.5px] transition-colors',
                  translated === wanted
                    ? 'border-signal bg-signal/10 text-ink'
                    : 'border-paper-line bg-paper-sunk/60 text-ink-soft hover:border-ink-mute',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-[1.4] text-ink-mute">
            <Languages size={10} className="mt-[2px] shrink-0" />
            {translated
              ? 'Every word is translated to English and the English is embedded, so the point labelled собака holds the vector for dog. The query gets translated too — this is how multilingual search worked before cross-lingual models were any good.'
              : 'The model sees the word as it was written. Whether that puts translations together is up to the model.'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
