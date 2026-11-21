/**
 * The knobs for the current method.
 *
 * Only rendered when the method has any, and the bounds come from the backend
 * rather than from here — the raw-dimension sliders have to run to 3071 on
 * text-embedding-3-large and 299 on GloVe, and the server is the thing that
 * knows which. Changing a value refetches, so these are the parameters of the
 * question rather than a display preference.
 *
 * Two kinds of control. A `choice` param is a segmented button group and its
 * value is a string; everything else is a range slider and its value is a
 * number. That distinction is load-bearing rather than cosmetic: this file
 * used to coerce every incoming value with `Number()`, which would have turned
 * raw mode's "most varied" into `NaN` and quietly reset the picker.
 */
export default function MethodParams({ method, values, onChange, sourceDims, disabled }) {
  if (!method?.params?.length) return null

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {method.params.map((param) => {
        const value = values?.[param.id] ?? param.default

        if (param.type === 'choice') {
          return (
            <div
              key={param.id}
              className="flex min-w-[168px] items-center gap-2"
              title={param.hint || ''}
            >
              <span className="w-[86px] shrink-0 text-[11px] leading-tight text-glow-soft">
                {param.label}
              </span>
              <div className="flex gap-1">
                {param.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    aria-pressed={value === option.value}
                    onClick={() => onChange(param.id, option.value)}
                    className={[
                      'rounded-[3px] px-2 py-[3px] text-[10.5px] transition-colors disabled:opacity-40',
                      value === option.value
                        ? 'bg-white/15 text-white'
                        : 'bg-white/5 text-glow-soft/70 hover:text-glow-soft',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )
        }

        // Raw mode indexes into the vector itself, so its ceiling is the
        // source's dimensionality, not a constant.
        const max = method.id === 'raw' ? Math.max(1, (sourceDims || 300) - 1) : param.max
        // The index sliders are meaningless while the dimensions are being
        // chosen by variance instead, so they grey out rather than sit there
        // implying they still do something.
        const overridden =
          method.id === 'raw' &&
          param.id.startsWith('dim_') &&
          (values?.select ?? 'index') !== 'index'

        return (
          <label
            key={param.id}
            className={[
              'flex min-w-[168px] flex-1 items-center gap-2',
              overridden ? 'opacity-40' : '',
            ].join(' ')}
          >
            <span className="w-[86px] shrink-0 text-[11px] leading-tight text-glow-soft">
              {param.label}
            </span>
            <input
              type="range"
              min={param.min}
              max={max}
              step={param.step}
              value={value}
              disabled={disabled || overridden}
              onChange={(event) => onChange(param.id, Number(event.target.value))}
              title={
                overridden
                  ? 'Switch "Pick by" back to index to choose dimensions yourself'
                  : param.hint || ''
              }
              className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-signal-lift disabled:opacity-40"
            />
            <span className="tnum w-10 shrink-0 text-right text-[11px] text-white">
              {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}
            </span>
          </label>
        )
      })}
    </div>
  )
}
