import { num, pct } from '../lib/format'

/**
 * The method switch, built as a scoreboard.
 *
 * Switching projection is the point of the application, so the switch is not a
 * dropdown — it is a row across the foot of the viewport, and each method
 * keeps the trustworthiness score it earned on the *current* word set once it
 * has been run. Two or three clicks in and the control has become a table of
 * which flattenings survive these particular words, which is a question the
 * user could not otherwise ask without writing down numbers by hand.
 *
 * Scores are cleared whenever the words or the source change, because a score
 * from a different scene would be a lie in a very convincing position.
 */
export default function MethodTabs({ methods, value, onChange, scores, busy }) {
  return (
    <div
      role="tablist"
      aria-label="Projection method"
      className="flex flex-wrap items-stretch gap-px border-t border-white/10 bg-vacuum/95"
    >
      {methods.map((method) => {
        const selected = method.id === value
        const score = scores[method.id]
        const disabled = !method.available
        return (
          <button
            key={method.id}
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(method.id)}
            title={disabled ? method.unavailable_reason : method.blurb}
            className={[
              'group min-w-[104px] flex-1 px-3 py-2 text-left transition-colors',
              selected ? 'bg-signal/18' : 'hover:bg-white/5',
              disabled ? 'cursor-not-allowed opacity-40' : '',
            ].join(' ')}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span
                className={[
                  'font-display text-[13px] font-semibold',
                  selected ? 'text-white' : 'text-glow-soft',
                ].join(' ')}
              >
                {method.label}
              </span>
              {busy && selected ? (
                <span className="text-[10px] text-glow-soft">…</span>
              ) : score !== undefined ? (
                <span
                  className="tnum text-[11px] text-white"
                  title={`Trustworthiness ${num(score, 3)} — how much of each point's real neighbourhood survived`}
                >
                  {pct(score)}
                </span>
              ) : (
                <span className="tnum text-[11px] text-white/25">–</span>
              )}
            </span>
            <span
              className={[
                'mt-0.5 block text-[10.5px] leading-tight',
                selected ? 'text-glow-soft' : 'text-glow-soft/55',
              ].join(' ')}
            >
              {method.blurb}
            </span>
          </button>
        )
      })}
    </div>
  )
}
