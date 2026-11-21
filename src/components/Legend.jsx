import { CATEGORICAL, CLUSTER_SHAPES, clustersUseColour, sequentialBands } from '../lib/palette'

/**
 * What the colours and shapes mean.
 *
 * Always present when there is more than one thing on screen to tell apart —
 * identity is never carried by colour alone. The cluster legend also explains
 * why colour stops at three groups, because a user who sees six identical grey
 * markers is entitled to think something is broken rather than deliberate.
 */
const SHAPE_GLYPH = {
  sphere: '●',
  box: '■',
  octahedron: '◆',
  tetrahedron: '▲',
  cone: '▼',
  cylinder: '⬭',
  torus: '◎',
  dodecahedron: '⬟',
}

export default function Legend({ mode, focus, clusterCount, clusterMembers, groups }) {
  // The two grid modes reuse the cluster encoding exactly: colour for three or
  // fewer categories, marker shape past that. The eight shapes are the ceiling,
  // which is also why no word grid here has more than eight languages.
  if (mode === 'language' || mode === 'concept') {
    const list = groups || []
    const usesColour = clustersUseColour(list.length)
    return (
      <div>
        <ul className="space-y-1">
          {list.map((group, i) => {
            const shape = CLUSTER_SHAPES[i % CLUSTER_SHAPES.length]
            const colour = usesColour ? CATEGORICAL[i % CATEGORICAL.length] : '#6f6e67'
            return (
              <li key={group.key} className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className="w-3 shrink-0 text-center text-[11px] leading-none"
                  style={{ color: colour }}
                >
                  {SHAPE_GLYPH[shape]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[11px] text-ink">{group.label}</span>
                  {group.members?.length ? (
                    <span className="ml-1 font-mono text-[10.5px] text-ink-mute">
                      {group.members.slice(0, 3).join(' ')}
                      {group.members.length > 3 ? ` +${group.members.length - 3}` : ''}
                    </span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-[10.5px] leading-[1.45] text-ink-mute">
          {mode === 'language'
            ? 'If these separate cleanly, the model has sorted by language rather than by meaning — and the words on screen mean only eight different things between them.'
            : 'If these separate cleanly, translations have landed together and the language has stopped mattering. That is the whole question, drawn.'}
        </p>
        {list.length > 3 ? (
          <p className="mt-1.5 text-[10.5px] leading-[1.45] text-ink-mute">
            Past three groups the markers differ by shape, not colour, for the
            same reason they do for k-means groups: in a view you can spin,
            every pair of colours eventually sits side by side.
          </p>
        ) : null}
      </div>
    )
  }

  if (mode === 'similarity') {
    if (!focus) {
      return (
        <p className="text-[11.5px] leading-[1.45] text-ink-soft">
          Click any word in the view. Everything else then shades by its true cosine
          similarity to that word, measured in full dimensions rather than read off
          the picture.
        </p>
      )
    }
    const bands = sequentialBands()
    return (
      <div>
        <p className="mb-2 text-[11.5px] leading-[1.45] text-ink-soft">
          Shaded by cosine similarity to{' '}
          <span className="font-mono text-ink">{focus}</span>.
        </p>
        <div className="flex h-4 w-full overflow-hidden rounded-[2px]">
          {bands.map((band) => (
            <div
              key={band.colour}
              className="flex-1"
              style={{ background: band.colour }}
              title={`${band.from.toFixed(2)} to ${band.to.toFixed(2)}`}
            />
          ))}
        </div>
        <div className="tnum mt-1 flex justify-between text-[10px] text-ink-mute">
          <span>0.00 unrelated</span>
          <span>1.00 identical</span>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-[1.4] text-ink-mute">
          Negative similarity is rare and clamps to the lightest step.
        </p>
      </div>
    )
  }

  if (mode === 'cluster') {
    const usesColour = clustersUseColour(clusterCount)
    return (
      <div>
        <ul className="space-y-1">
          {Array.from({ length: clusterCount }, (_, i) => {
            const shape = CLUSTER_SHAPES[i % CLUSTER_SHAPES.length]
            const colour = usesColour ? CATEGORICAL[i % CATEGORICAL.length] : '#6f6e67'
            const members = clusterMembers?.[i] || []
            return (
              <li key={i} className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className="w-3 shrink-0 text-center text-[11px] leading-none"
                  style={{ color: colour }}
                >
                  {SHAPE_GLYPH[shape]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[11px] text-ink">Group {i + 1}</span>
                  {members.length ? (
                    <span className="ml-1 font-mono text-[10.5px] text-ink-mute">
                      {members.slice(0, 4).join(' ')}
                      {members.length > 4 ? ` +${members.length - 4}` : ''}
                    </span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-[10.5px] leading-[1.45] text-ink-mute">
          {usesColour
            ? 'Colour and shape both carry the group, so the view survives greyscale and colour blindness.'
            : 'Past three groups the markers differ by shape, not colour: in a view you can spin, every pair of colours eventually sits side by side, and no six hues this close in lightness stay distinguishable to a colour-blind viewer on a dark ground.'}
        </p>
        <p className="mt-1.5 text-[10.5px] leading-[1.45] text-ink-mute">
          Groups come from k-means on the full vectors, not on the three coordinates —
          so when a group also lands together on screen, that is two independent
          readings agreeing.
        </p>
      </div>
    )
  }

  return (
    <p className="text-[11.5px] leading-[1.45] text-ink-soft">
      All markers the same. Position is the only encoding, which is the fairest way
      to look at a layout you have not chosen a question for yet.
    </p>
  )
}
