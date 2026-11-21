/**
 * One data layer, two backings.
 *
 * Live mode talks to the FastAPI service. Demo mode reads the precomputed
 * bundle in public/demo. The important property is that both return the *same
 * shapes*, so every component above this file is written once and never asks
 * which mode it is in — the only difference a component may observe is
 * `capabilities.canEmbed`, which gates the word input.
 *
 * Mode is decided by probing the backend once at startup rather than by a
 * build flag, so the same deployed bundle works with a backend, without one,
 * or with one that went down while the tab was open.
 */

// Where production builds look for the backend when VITE_API_BASE is not set.
//
// It is a default in code rather than an environment variable in a dashboard
// because two different pipelines build this app: Vercel builds it remotely
// from the uploaded source, and the Netlify job builds it on the runner and
// uploads the output. A value that has to be configured in both places is a
// value that is eventually missing from one; this one is simply in the bundle.
//
// `??` and not `||`, deliberately: VITE_API_BASE= (set, but empty) is the way
// to ask for a build with no backend at all, which serves the offline bundle.
// Development gets '' either way, so `npm run dev` keeps using the Vite proxy.
const DEFAULT_API_BASE = 'https://vsembeddings-api.krishnarajthadesar.in'

const API_BASE = (
  import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? DEFAULT_API_BASE : '')
).replace(/\/$/, '')
const DEMO_BASE = '/demo'

/** Fold an array of words into the {word: index} map the matrix is keyed by. */
function indexOf(words) {
  const map = new Map()
  words.forEach((w, i) => map.set(w, i))
  return map
}

async function getJSON(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* a non-JSON error body is still an error; the status line will do */
    }
    const error = new Error(detail)
    error.status = response.status
    throw error
  }
  return response.json()
}

// ---------------------------------------------------------------------------
// Live mode
// ---------------------------------------------------------------------------

const live = {
  mode: 'live',
  // canProfileDimensions is the one capability the offline bundle cannot fake.
  // Everything else it serves as precomputed answers; per-dimension readouts
  // would need the raw vectors, which are two orders of magnitude more data
  // than the cosine matrices the bundle ships.
  capabilities: { canEmbed: true, canArithmeticFreely: true, canProfileDimensions: true },

  async meta() {
    return getJSON(`${API_BASE}/api/meta`)
  },

  async scene({ source, words, method, params, clusters, neighbourK, anchor, includeMatrix = true, lexicon = '' }) {
    return getJSON(`${API_BASE}/api/scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        words,
        method,
        params: params || {},
        clusters: clusters || 0,
        neighbour_k: neighbourK ?? 3,
        anchor: anchor || {},
        include_matrix: includeMatrix,
        lexicon,
      }),
    })
  },

  async alignment({ source, lexicon }) {
    return getJSON(`${API_BASE}/api/alignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, lexicon }),
    })
  },

  async pivot({ source, lexicon }) {
    return getJSON(`${API_BASE}/api/pivot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, lexicon }),
    })
  },

  async dimensions({ source, word, words, topK = 8 }) {
    return getJSON(`${API_BASE}/api/dimensions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, word, words, top_k: topK }),
    })
  },

  async arithmetic({ source, terms, topk = 8 }) {
    return getJSON(`${API_BASE}/api/arithmetic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, terms, topk }),
    })
  },

  async neighbours({ source, word, k = 10 }) {
    const query = new URLSearchParams({ source, word, k: String(k) })
    return getJSON(`${API_BASE}/api/neighbours?${query}`)
  },

  async seed({ source }) {
    return getJSON(`${API_BASE}/api/index/seed?source=${encodeURIComponent(source)}`, {
      method: 'POST',
    })
  },
}

// ---------------------------------------------------------------------------
// Demo mode
// ---------------------------------------------------------------------------

/**
 * The bundle is keyed by (source, preset), so demo mode can only answer for a
 * word list that *is* one of the presets. Rather than fail on an arbitrary
 * list, it finds the preset whose words match and serves that — which is why
 * the UI disables editing the word list offline instead of letting it drift
 * into a state with no answer.
 */
function makeDemo(index) {
  const cache = new Map()

  async function loadScene(source, presetId) {
    const key = `${source}__${presetId}`
    if (!cache.has(key)) {
      cache.set(key, getJSON(`${DEMO_BASE}/${key}.json`))
    }
    return cache.get(key)
  }

  function presetFor(words) {
    const wanted = new Set(words.map((w) => w.toLowerCase()))
    let best = null
    let bestScore = -1
    for (const preset of index.presets) {
      const theirs = preset.words.map((w) => w.toLowerCase())
      const overlap = theirs.filter((w) => wanted.has(w)).length
      // Prefer the preset that covers the most of what was asked for, and
      // break ties toward the smaller set so a subset does not match a
      // superset by accident.
      const score = overlap * 1000 - Math.abs(theirs.length - wanted.size)
      if (overlap > 0 && score > bestScore) {
        bestScore = score
        best = preset
      }
    }
    return best
  }

  return {
    mode: 'demo',
    capabilities: {
      canEmbed: false,
      canArithmeticFreely: false,
      canProfileDimensions: false,
    },

    async meta() {
      return {
        sources: index.sources.map((s) => ({
          ...s,
          available: true,
          unavailable_reason: '',
          indexed: 0,
          vocab_size: s.provider === 'glove' ? 50000 : 0,
        })),
        methods: index.methods.map((m) => ({ ...m, available: true, unavailable_reason: '' })),
        presets: index.presets,
        lexicons: index.lexicons || [],
        glossary: index.glossary || [],
        analogies: index.analogies
          .filter((a) => a.source === index.sources[0]?.id)
          .map((a) => ({ label: a.label, terms: a.terms, expect: a.expect, note: a.note })),
        sampler: index.sampler || [],
        default_source: index.sources.some((s) => s.id === 'glove-300')
          ? 'glove-300'
          : index.sources[0]?.id,
        default_method: 'umap',
        max_words: 2000,
        generated_at: index.generated_at,
      }
    },

    async scene({ source, words, method, clusters, neighbourK = 3 }) {
      const preset = presetFor(words)
      if (!preset) {
        throw new Error('Demo mode only has the built-in word sets. Pick one from the list.')
      }
      const data = await loadScene(source, preset.id)
      const projection = data.projections[method]
      if (!projection) {
        throw new Error(
          `The offline bundle has no ${method} layout for this set — it needs at least a few more words.`,
        )
      }

      const labels =
        clusters > 1 && data.clusters[String(clusters)]
          ? data.clusters[String(clusters)]
          : data.words.map(() => 0)

      // Neighbours within the scene are derived from the matrix rather than
      // shipped, because the matrix already contains them and duplicating
      // them offline would only let the two disagree.
      const neighbours = {}
      if (neighbourK > 0 && data.words.length > 1) {
        const k = Math.min(neighbourK, data.words.length - 1)
        data.words.forEach((word, i) => {
          neighbours[word] = data.matrix[i]
            .map((similarity, j) => ({ word: data.words[j], similarity }))
            .filter((_, j) => j !== i)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, k)
        })
      }

      return {
        source,
        method,
        // Straight from the bundle rather than recomputed: the grid labels are
        // keyed by the same normalisation the backend used, and re-deriving
        // them in the browser would be a second place for that to go wrong.
        labels: data.labels || {},
        points: data.words.map((word, i) => ({
          word,
          x: projection.points[i][0],
          y: projection.points[i][1],
          z: projection.points[i][2],
          cluster: labels[i] ?? 0,
        })),
        projection: projection.meta,
        neighbours,
        top_pairs: data.top_pairs,
        matrix: data.matrix,
        missing: data.missing || [],
        newly_embedded: [],
        // Per-method, because whether a projection drew identical vectors on
        // top of each other or spread them apart is a property of the method.
        notes: projection.notes || [],
      }
    },

    async arithmetic({ source, terms }) {
      const wanted = terms.map(([word, sign]) => `${sign > 0 ? '+' : '-'}${word.toLowerCase()}`).join(' ')
      const match = index.analogies.find((a) => {
        if (a.source !== source) return false
        const theirs = a.terms.map((t) => `${t.sign > 0 ? '+' : '-'}${t.word.toLowerCase()}`).join(' ')
        return theirs === wanted
      })
      if (!match) {
        throw new Error(
          'Offline, only the six built-in analogies are precomputed. Connect the backend to build your own.',
        )
      }
      return {
        result: match.result,
        terms: match.term_similarities,
        unknown: match.unknown || [],
        pool: match.pool,
        norm: 0,
        note: match.note || '',
      }
    },

    async neighbours({ source, word, k = 10 }) {
      const key = word.toLowerCase()
      const hits = index.neighbours?.[key]
      if (!hits) {
        throw new Error(`No offline neighbour list for "${word}".`)
      }
      return { word: key, neighbours: hits.slice(0, k), pool: 'the full 50k GloVe vocabulary' }
    },

    /**
     * Offline these are lookups, not computations.
     *
     * The alignment numbers are properties of the *model*, measured on the
     * full vectors — so unlike a projection they do not change when the user
     * flips a method, and shipping them as answers costs a few kilobytes.
     * Recomputing them in the browser would mean shipping the vectors, which
     * is the one thing the bundle cannot afford.
     */
    async alignment({ source, lexicon }) {
      const hit = index.alignment?.[`${source}__${lexicon}`]
      if (!hit) {
        throw new Error(
          `The offline bundle has no alignment report for ${source} on this word set.`,
        )
      }
      return hit
    },

    async pivot({ source, lexicon }) {
      const hit = (index.pivot || []).find(
        (row) => row.lexicon === lexicon && row.native_source === source,
      )
      if (!hit) {
        throw new Error(
          `The offline bundle has no translate-first comparison for ${source} on this word set.`,
        )
      }
      return { ...hit, translations: index.translations || [], notes: [] }
    },

    async dimensions() {
      throw new Error(
        'Per-dimension readouts need the raw vectors, and the bundle ships ' +
          'cosine similarities instead. Start the backend to use this panel.',
      )
    },

    async seed() {
      throw new Error('Nothing to seed offline — the bundle is already built.')
    },
  }
}

// ---------------------------------------------------------------------------
// Picking a mode
// ---------------------------------------------------------------------------

/**
 * Probe the backend, fall back to the bundle.
 *
 * The timeout matters: a backend that is reachable but hanging would otherwise
 * hold the whole page on a blank screen, and the offline bundle is right there.
 * Two and a half seconds is long enough for a cold local uvicorn and short
 * enough not to feel like a failure.
 */
export async function connect({ timeoutMs = 2500 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const meta = await getJSON(`${API_BASE}/api/meta`, { signal: controller.signal })
    clearTimeout(timer)
    return { client: live, meta, reason: '' }
  } catch (error) {
    clearTimeout(timer)
    try {
      const index = await getJSON(`${DEMO_BASE}/index.json`)
      const demo = makeDemo(index)
      return {
        client: demo,
        meta: await demo.meta(),
        reason:
          error.name === 'AbortError'
            ? 'the backend did not answer in time'
            : error.message || 'the backend is not reachable',
      }
    } catch {
      // Both gone. Let the caller render the failure rather than a blank page.
      throw new Error(
        'No backend and no offline bundle. If this is a fresh checkout, run ' +
          'scripts/export_demo.py in the backend repo to build public/demo.',
      )
    }
  }
}

export { indexOf }
