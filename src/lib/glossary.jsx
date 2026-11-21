import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * Explanations for the terms the interface uses, from the backend.
 *
 * The definitions live in `app/data/glossary.py` and arrive with `/api/meta`,
 * for the same reason the presets and method descriptions do: the definition
 * of trustworthiness belongs next to the code that computes trustworthiness,
 * and a second copy in a React component is a second thing to keep true. This
 * file is only the delivery mechanism.
 *
 * ## Why not a floating tooltip
 *
 * Both instrument rails are `overflow-y-auto`, which clips any absolutely
 * positioned child — so a hover card would need a portal to document.body plus
 * measurement and flipping logic to stay on screen in a 284px column. That is
 * a lot of machinery to be wrong in ways that only show up visually.
 *
 * Instead a term is a button: hovering gives the browser's own tooltip (which
 * renders above everything and is never clipped), and clicking expands the
 * explanation inline, pushing the panel down. Inline expansion also works on
 * touch, where hover does not exist at all — and the interface is used on a
 * phone often enough that a hover-only explanation would be no explanation.
 * The full detail for every term is in the reference list, which is the
 * fallback the layout can always afford.
 */

const GlossaryContext = createContext({ terms: new Map(), topics: [] })

export function GlossaryProvider({ glossary, children }) {
  const value = useMemo(() => {
    const terms = new Map((glossary || []).map((term) => [term.id, term]))
    const topics = []
    for (const term of glossary || []) {
      if (term.topic && !topics.includes(term.topic)) topics.push(term.topic)
    }
    return { terms, topics }
  }, [glossary])
  return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>
}

export function useGlossary() {
  return useContext(GlossaryContext)
}

/**
 * A term with its explanation one click away.
 *
 * Renders its children unchanged when the backend has no entry for the id, so
 * adding a `<Term>` for something not yet written degrades to plain text
 * rather than breaking the sentence it is in.
 */
export function Term({ id, children, className = '' }) {
  const { terms } = useGlossary()
  const [open, setOpen] = useState(false)
  const term = terms.get(id)
  const label = children ?? term?.label ?? id

  const toggle = useCallback(() => setOpen((value) => !value), [])

  if (!term) return <>{label}</>

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title={term.short}
        className={[
          'cursor-help border-b border-dotted border-current/50 text-left',
          'hover:border-current focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal',
          className,
        ].join(' ')}
      >
        {label}
      </button>
      {open ? (
        <span className="mt-1 block rounded-[3px] border border-paper-line bg-paper-sunk px-2 py-1.5 text-[10.5px] font-normal leading-[1.45] text-ink-soft">
          {term.short}
        </span>
      ) : null}
    </>
  )
}
