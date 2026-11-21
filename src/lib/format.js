/** Number and text formatting. Everything numeric on screen comes through here. */

/** Cosine similarity: two decimals, signed, always the same width. */
export function sim(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value < 0 ? value.toFixed(2) : value.toFixed(2)
}

/** A 0-1 quality metric as a percentage, for metrics that read as "how much". */
export function pct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${Math.round(value * 100)}%`
}

export function num(value, places = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(places)
}

export function count(value) {
  return new Intl.NumberFormat('en-US').format(value)
}

/**
 * Split a typed word list. Commas and newlines separate; spaces do not,
 * because the OpenAI sources embed whole phrases and "new york" has to be
 * able to arrive as one entry.
 */
export function parseWords(text) {
  return text
    .split(/[,\n]/)
    .map((w) => w.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
}

/**
 * Plain-language readings of the two quality metrics.
 *
 * These exist because "trustworthiness 0.72" is not information to someone
 * meeting the idea for the first time, and the number without the reading is
 * the difference between a tool that teaches and a tool that decorates.
 */
export function readTrust(value) {
  if (value === null || value === undefined) return null
  if (value >= 0.9) return 'neighbours almost all survived the flattening'
  if (value >= 0.75) return 'most neighbours survived'
  if (value >= 0.6) return 'about half the neighbourhoods are real'
  return 'neighbours on screen are mostly an artefact of the layout'
}

export function readDistance(value) {
  if (value === null || value === undefined) return null
  if (value >= 0.8) return 'distances on screen track the real ones closely'
  if (value >= 0.6) return 'distances are roughly proportional'
  if (value >= 0.35) return 'only the broad ordering of distances holds'
  if (value >= 0.15) return 'distances are barely related to the real ones'
  return 'distances on screen carry no information'
}
