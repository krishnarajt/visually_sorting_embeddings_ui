import { Sparkles } from 'lucide-react'

/**
 * The curated word sets, and the sampler of loose words.
 *
 * Every set exists to make one property of embedding space visible, so each
 * carries the thing to look for once it is loaded. A 3-D scatter of words
 * chosen at random teaches nothing; these were chosen.
 */
export default function PresetList({ presets, sourceId, active, onLoad }) {
  return (
    <div className="space-y-1">
      {presets.map((preset) => {
        const unsupported = preset.sources?.length && !preset.sources.includes(sourceId)
        const selected = active === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            disabled={unsupported}
            onClick={() => onLoad(preset)}
            className={[
              'w-full rounded-[3px] border px-2.5 py-2 text-left transition-colors',
              selected
                ? 'border-signal bg-signal/10'
                : 'border-transparent bg-paper-sunk/50 hover:border-paper-line',
              unsupported ? 'cursor-not-allowed opacity-50' : '',
            ].join(' ')}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-medium text-ink">{preset.label}</span>
              <span className="tnum shrink-0 text-[10px] text-ink-mute">
                {preset.words.length}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] leading-[1.4] text-ink-soft">
              {unsupported ? 'Needs an OpenAI source — GloVe has no vector for a sentence.' : preset.blurb}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Sampler({ words, onAdd, disabled }) {
  if (!words?.length) return null
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-ink-soft">
        <Sparkles size={11} className="shrink-0 text-ink-mute" />
        Click to drop one into the scene.
      </p>
      <div className="flex flex-wrap gap-1">
        {words.map((word) => (
          <button
            key={word}
            type="button"
            disabled={disabled}
            onClick={() => onAdd(word)}
            className="rounded-[3px] border border-paper-line bg-white/60 px-1.5 py-[3px] font-mono text-[11px] text-ink transition-colors hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-45"
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  )
}
