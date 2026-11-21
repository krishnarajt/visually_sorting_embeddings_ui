/**
 * Colour and marker assignment, kept in one file so the viewport, the legend
 * and the matrix cannot drift apart.
 *
 * The interface teaches exactly one colour association: **darker blue means
 * more similar**. The point cloud shades by similarity to the focused word and
 * the matrix shades by pairwise similarity, both on the same seven-step blue
 * ramp, so a colour learned in one place reads correctly in the other. That is
 * also why the matrix is sequential rather than diverging — a diverging scale
 * would need a second hue for its far pole and would put "similar" in red here
 * while "similar" was blue three inches away.
 */

/** The validated sequential blue, light to dark. Low similarity to high. */
export const SEQUENTIAL = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
]

/**
 * Categorical slots for clusters — three, and no more.
 *
 * A 3-D scatter is an all-pairs form: spin the camera and every group ends up
 * adjacent to every other, so each pair of colours has to survive on its own.
 * These three do (worst pair ΔE 9.4 under deuteranopia, 20.9 in normal vision,
 * against the #1a1a19 surface). Six do not — no subset of six hues in the
 * lightness band the dark surface needs clears the colour-blind floor, which
 * was measured rather than guessed. So past three groups this app stops using
 * colour and switches to marker shape; see CLUSTER_SHAPES.
 */
export const CATEGORICAL = ['#3987e5', '#d95926', '#199e70']

/**
 * Shapes, in assignment order. Chosen for silhouette rather than for geometric
 * tidiness: a sphere, a cube and an octahedron are still telling apart at ten
 * pixels, where a dodecahedron and a sphere are not, so the rounder solids sit
 * at the end where they are least likely to be reached.
 */
export const CLUSTER_SHAPES = [
  'sphere',
  'box',
  'octahedron',
  'tetrahedron',
  'cone',
  'cylinder',
  'torus',
  'dodecahedron',
]

/** True when the cluster count is small enough for colour to do the work. */
export function clustersUseColour(k) {
  return k > 1 && k <= CATEGORICAL.length
}

/**
 * How a cluster is drawn. Under four groups, colour carries it and shape is
 * redundant reinforcement (which is what makes the chart survive greyscale
 * printing and colour blindness). At four and above, colour drops out entirely
 * rather than start repeating itself, and shape carries it alone.
 */
export function clusterMark(clusterIndex, k) {
  if (clustersUseColour(k)) {
    return {
      colour: CATEGORICAL[clusterIndex % CATEGORICAL.length],
      shape: CLUSTER_SHAPES[clusterIndex % CLUSTER_SHAPES.length],
    }
  }
  return {
    colour: '#c3c2b7',
    shape: CLUSTER_SHAPES[clusterIndex % CLUSTER_SHAPES.length],
  }
}

/**
 * Similarity to a colour, on the seven documented steps rather than a smooth
 * gradient.
 *
 * Binned on purpose: a continuous gradient looks better and cannot be read —
 * nobody eyeballs the difference between 0.42 and 0.48 of a hue rotation.
 * Seven steps can be matched back to the legend by eye, which is the only
 * reason to colour by magnitude at all.
 *
 * Cosine runs to -1 in principle. In practice under 2% of real pairs come out
 * negative and none by much, so the scale starts at 0 and anything below it
 * clamps to the lightest step — spending half the ramp on a case that barely
 * occurs would flatten the half that does.
 */
export function similarityColour(similarity) {
  const t = Math.max(0, Math.min(1, similarity))
  const step = Math.min(SEQUENTIAL.length - 1, Math.floor(t * SEQUENTIAL.length))
  return SEQUENTIAL[step]
}

/** The bucket bounds, for drawing the legend the ramp is read against. */
export function sequentialBands() {
  const n = SEQUENTIAL.length
  return SEQUENTIAL.map((colour, i) => ({
    colour,
    from: i / n,
    to: (i + 1) / n,
  }))
}

/** Neutral marker colour when nothing is focused and clusters are off. */
export const PLAIN_MARK = '#8fa3b8'

/** The focused word itself, which must not be mistaken for a ramp step. */
export const FOCUS_MARK = '#ffffff'
