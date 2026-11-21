/**
 * A titled block in the instrument rail.
 *
 * Hairline-separated sections on one continuous paper surface rather than a
 * stack of floating cards: the rail is a single panel with divisions milled
 * into it, and nothing here is independently draggable or dismissable, so
 * giving each part its own border, radius and shadow would be describing a
 * structure that does not exist.
 */
export default function Section({ title, hint, right, children }) {
  return (
    <section className="border-b border-paper-line px-4 py-3.5">
      <header className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[13px] font-semibold tracking-[0.01em] text-ink">
          {title}
        </h2>
        {right}
      </header>
      {hint ? <p className="mb-2.5 text-[11.5px] leading-[1.45] text-ink-soft">{hint}</p> : null}
      {children}
    </section>
  )
}
