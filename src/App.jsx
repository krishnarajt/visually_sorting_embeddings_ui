import { AlertCircle, Database, Loader2, Network, Orbit, Type, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Alignment from './components/Alignment'
import Arithmetic from './components/Arithmetic'
import Dimensions from './components/Dimensions'
import EmbeddingLens, { LensControls } from './components/EmbeddingLens'
import Extremes from './components/Extremes'
import Inspector from './components/Inspector'
import Legend from './components/Legend'
import Matrix from './components/Matrix'
import MethodParams from './components/MethodParams'
import MethodTabs from './components/MethodTabs'
import MetricPanel from './components/MetricPanel'
import PresetList, { Sampler } from './components/PresetList'
import Reference from './components/Reference'
import Section from './components/Section'
import SourcePicker from './components/SourcePicker'
import Viewport from './components/Viewport'
import WordInput from './components/WordInput'
import { connect } from './lib/api'
import { count } from './lib/format'
import { GlossaryProvider, Term } from './lib/glossary'
import { FOCUS_MARK, PLAIN_MARK, clusterMark, similarityColour } from './lib/palette'

/** Which preset opens the app. The six-field set is the one where every method agrees. */
const OPENING_PRESET = 'clusters'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export default function App() {
  const reducedMotion = usePrefersReducedMotion()

  const [connection, setConnection] = useState(null)
  const [bootError, setBootError] = useState('')

  const [sourceId, setSourceId] = useState('')
  const [methodId, setMethodId] = useState('')
  const [paramsByMethod, setParamsByMethod] = useState({})
  const [words, setWords] = useState([])
  const [activePreset, setActivePreset] = useState('')

  const [scene, setScene] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sceneError, setSceneError] = useState('')
  const [methodScores, setMethodScores] = useState({})

  const [focus, setFocus] = useState(null)
  const [hover, setHover] = useState(null)
  const [lens, setLens] = useState('map')
  const [axisWord, setAxisWord] = useState('')
  const [compareWord, setCompareWord] = useState('')
  const [colourMode, setColourMode] = useState('similarity')
  const [clusterCount, setClusterCount] = useState(6)
  const [showLabels, setShowLabels] = useState(true)
  const [showEdges, setShowEdges] = useState(true)
  const [seedState, setSeedState] = useState('')

  // Previous coordinates, fed back to the server so t-SNE and UMAP can be
  // rotated onto the last frame instead of arriving mirrored. A ref rather
  // than state: it must not itself trigger the fetch that produces it.
  const anchorRef = useRef({})

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    connect()
      .then(({ client, meta, reason }) => {
        if (cancelled) return
        setConnection({ client, meta, reason })
        const firstSource =
          meta.sources.find((s) => s.id === meta.default_source && s.available) ||
          meta.sources.find((s) => s.available)
        setSourceId(firstSource?.id || '')
        const firstMethod =
          meta.methods.find((m) => m.id === meta.default_method && m.available) ||
          meta.methods.find((m) => m.available)
        setMethodId(firstMethod?.id || '')
        setParamsByMethod(
          Object.fromEntries(
            meta.methods.map((m) => [
              m.id,
              Object.fromEntries(m.params.map((p) => [p.id, p.default])),
            ]),
          ),
        )
        const opening =
          meta.presets.find((p) => p.id === OPENING_PRESET) || meta.presets[0]
        if (opening) {
          setWords(opening.words)
          setActivePreset(opening.id)
        }
      })
      .catch((error) => {
        if (!cancelled) setBootError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const meta = connection?.meta
  const client = connection?.client
  const source = useMemo(
    () => meta?.sources.find((s) => s.id === sourceId),
    [meta, sourceId],
  )
  const method = useMemo(
    () => meta?.methods.find((m) => m.id === methodId),
    [meta, methodId],
  )

  // The concept-by-language grid behind the loaded word set, if it is one.
  // Declared up here because the scene request below needs it: a grid is what
  // unlocks the language and meaning colourings and the alignment panel, and
  // an ordinary word list leaves all three absent rather than empty.
  const activeLexicon = useMemo(
    () => meta?.presets.find((p) => p.id === activePreset)?.lexicon || '',
    [meta, activePreset],
  )
  const lexicon = useMemo(
    () => meta?.lexicons?.find((l) => l.id === activeLexicon) || null,
    [meta, activeLexicon],
  )

  // A score measured on one word set says nothing about another, and leaving a
  // stale number under a method name would be the most convincing kind of
  // wrong. Clear on any change that invalidates them.
  useEffect(() => {
    setMethodScores({})
    anchorRef.current = {}
  }, [sourceId, words])

  // ---------------------------------------------------------------------
  // The scene
  // ---------------------------------------------------------------------

  useEffect(() => {
    if (!client || !sourceId || !methodId || !words.length) {
      if (!words.length) setScene(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      setBusy(true)
      setSceneError('')
      client
        .scene({
          source: sourceId,
          words,
          method: methodId,
          params: paramsByMethod[methodId] || {},
          clusters: colourMode === 'cluster' ? clusterCount : 0,
          neighbourK: 4,
          anchor: anchorRef.current,
          includeMatrix: true,
          // Named so the response carries a language and a concept per point.
          // Sent rather than inferred: the server owns the word grids, and
          // matching them back by word list in the browser would be a second
          // copy of that knowledge.
          lexicon: activeLexicon,
        })
        .then((data) => {
          if (cancelled) return
          setScene(data)
          setFocus((current) => data.points.some((point) => point.word === current) ? current : data.points[0]?.word || null)
          anchorRef.current = Object.fromEntries(
            data.points.map((p) => [p.word, [p.x, p.y, p.z]]),
          )
          if (typeof data.projection?.trustworthiness === 'number') {
            setMethodScores((prev) => ({
              ...prev,
              [methodId]: data.projection.trustworthiness,
            }))
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setSceneError(error.message)
            setScene(null)
          }
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [client, sourceId, methodId, words, paramsByMethod, colourMode, clusterCount, activeLexicon])

  // Dropping a word that was selected should not leave a phantom selection.
  useEffect(() => {
    if (focus && scene && !scene.points.some((p) => p.word === focus)) setFocus(null)
  }, [focus, scene])

  // ---------------------------------------------------------------------
  // Derived view state
  // ---------------------------------------------------------------------

  const similarityTo = useMemo(() => {
    if (!scene?.matrix || !focus) return null
    const index = scene.points.findIndex((p) => p.word === focus)
    if (index < 0) return null
    const map = new Map()
    scene.points.forEach((p, i) => map.set(p.word, scene.matrix[index][i]))
    return map
  }, [scene, focus])

  /**
   * The grid axes, as ordered category lists with a slot index per word.
   *
   * Two encodings over the same points: `language` asks whether the model
   * sorted by the surface, `concept` whether it sorted by the meaning. Both
   * reuse `clusterMark`, so they inherit the palette's measured decision to
   * stop using colour past three categories and switch to marker shape — which
   * is why eight languages is the ceiling for a word grid here.
   */
  const grouping = useMemo(() => {
    if (!scene?.labels || !lexicon) return null
    const axis = colourMode === 'language' ? 'language' : 'concept'
    const order =
      axis === 'language'
        ? lexicon.languages.map((l) => ({ key: l.code, label: `${l.label} · ${l.endonym}` }))
        : lexicon.concepts.map((c) => ({ key: c.id, label: c.gloss }))
    const slotOf = new Map(order.map((entry, i) => [entry.key, i]))
    const members = new Map(order.map((entry) => [entry.key, []]))
    const slotByWord = new Map()
    scene.points.forEach((point) => {
      const key = scene.labels[point.word]?.[axis]
      if (key === undefined || !slotOf.has(key)) return
      slotByWord.set(point.word, slotOf.get(key))
      members.get(key).push(point.word)
    })
    return {
      axis,
      total: order.length,
      slotByWord,
      groups: order.map((entry) => ({ ...entry, members: members.get(entry.key) })),
    }
  }, [scene, lexicon, colourMode])

  const grouped = colourMode === 'language' || colourMode === 'concept'

  const colourFor = useCallback(
    (point) => {
      if (focus === point.word) return FOCUS_MARK
      if (grouped && grouping) {
        const slot = grouping.slotByWord.get(point.word)
        // A word with no label — the user added it by hand to a grid — stays
        // neutral rather than joining whichever group index 0 happens to be.
        return slot === undefined
          ? PLAIN_MARK
          : clusterMark(slot, grouping.total).colour
      }
      if (colourMode === 'cluster') return clusterMark(point.cluster, clusterCount).colour
      if (colourMode === 'similarity' && similarityTo) {
        return similarityColour(similarityTo.get(point.word) ?? 0)
      }
      return PLAIN_MARK
    },
    [colourMode, clusterCount, similarityTo, focus, grouped, grouping],
  )

  const markFor = useCallback(
    (point) => {
      if (grouped && grouping) {
        const slot = grouping.slotByWord.get(point.word)
        return slot === undefined
          ? { colour: PLAIN_MARK, shape: 'sphere' }
          : clusterMark(slot, grouping.total)
      }
      return colourMode === 'cluster'
        ? clusterMark(point.cluster, clusterCount)
        : { colour: PLAIN_MARK, shape: 'sphere' }
    },
    [colourMode, clusterCount, grouped, grouping],
  )

  const edges = useMemo(() => {
    if (!showEdges || !scene || !focus) return []
    return (scene.neighbours?.[focus] || []).map((hit) => ({
      from: focus,
      to: hit.word,
      similarity: hit.similarity,
    }))
  }, [showEdges, scene, focus])

  const clusterMembers = useMemo(() => {
    if (!scene || colourMode !== 'cluster') return {}
    const groups = {}
    scene.points.forEach((p) => {
      groups[p.cluster] = groups[p.cluster] || []
      groups[p.cluster].push(p.word)
    })
    return groups
  }, [scene, colourMode])

  const presetLookFor = useMemo(
    () => meta?.presets.find((p) => p.id === activePreset)?.look_for || '',
    [meta, activePreset],
  )

  // Loading an ordinary word list while coloured by language would leave the
  // view uniformly grey with a legend for categories that are not there.
  useEffect(() => {
    if (!activeLexicon && (colourMode === 'language' || colourMode === 'concept')) {
      setColourMode('similarity')
    }
  }, [activeLexicon, colourMode])

  const sceneWords = scene?.points.map((point) => point.word) || []
  const reference = sceneWords.includes(focus) ? focus : sceneWords[0]
  const guide = sceneWords.includes(axisWord) && axisWord !== reference ? axisWord : sceneWords.find((word) => word !== reference)
  const comparison = sceneWords.includes(compareWord) && compareWord !== reference ? compareWord : scene?.neighbours?.[reference]?.[0]?.word || guide

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  const addWord = useCallback((word) => {
    const clean = word.trim().toLowerCase()
    if (!clean) return
    setWords((prev) => (prev.includes(clean) ? prev : [...prev, clean]))
    setActivePreset('')
  }, [])

  function loadPreset(preset) {
    setWords(preset.words)
    setActivePreset(preset.id)
    setFocus(null)
    setAxisWord('')
    setCompareWord('')
    setSettingsOpen(false)
  }

  async function seed() {
    if (!client || !source) return
    setSeedState('working')
    try {
      const result = await client.seed({ source: sourceId })
      setSeedState(`indexed ${count(result.count)} words`)
    } catch (error) {
      setSeedState(error.message)
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (bootError) {
    return (
      <div className="flex h-full items-center justify-center bg-vacuum p-8">
        <div className="max-w-md">
          <h1 className="font-display text-xl font-semibold text-white">
            Nothing to show yet
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-glow-soft">{bootError}</p>
        </div>
      </div>
    )
  }

  if (!connection) {
    return (
      <div className="flex h-full items-center justify-center bg-vacuum">
        <p className="flex items-center gap-2 text-[13px] text-glow-soft">
          <Loader2 size={15} className="animate-spin" />
          Looking for a backend…
        </p>
      </div>
    )
  }

  const demo = connection.client.mode === 'demo'

  return (
    // Every explanation in the interface comes from the backend's glossary, so
    // the whole tree gets it rather than each panel importing its own copy.
    <GlossaryProvider glossary={meta.glossary}>
    <div className="embedding-app">
      <header className="app-header">
        <div className="app-brand"><Orbit size={29} /><h1>visually sorting embeddings<span>.</span></h1></div>
        <label className="collection-switch">
          <span>Collection</span>
          <select aria-label="Word collection" value={activePreset} onChange={(event) => loadPreset(meta.presets.find((preset) => preset.id === event.target.value))}>
            <option value="" disabled>Custom collection</option>
            {meta.presets.map((preset) => <option key={preset.id} value={preset.id} disabled={preset.sources?.length && !preset.sources.includes(sourceId)}>{preset.label}</option>)}
          </select>
        </label>
        <span className="connection-state"><i />{demo ? 'Precomputed' : 'Live model'}</span>
      </header>
      <div className="workspace-shell">
      {/* ---------------- Instrument rail ----------------
          A permanent column rather than a drawer. Which model you are looking
          at and which words are in it are not settings you configure once and
          put away — they are the two variables of the comparison, and half the
          point of the app is switching them and watching the readouts on the
          right move. Behind a toggle they cost a click each way and stopped
          being switchable at a glance. */}
      <aside className="setup-rail rail-scroll" aria-label="Dataset and model">
        <div className="border-b border-paper-line px-4 pb-3 pt-4">
          <div className="rail-heading"><h2>Dataset &amp; model</h2></div>
          {demo ? (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-[3px] border border-paper-line bg-paper-sunk px-2 py-1.5 text-[10.5px] leading-[1.45] text-ink-soft">
              <WifiOff size={11} className="mt-[2px] shrink-0" />
              <span>Precomputed vectors. Live backend unavailable.</span>
            </p>
          ) : null}
        </div>

        <Section
          title="Model"
          hint={source?.blurb}
          right={
            !demo && source?.provider !== 'glove' ? (
              <button
                type="button"
                onClick={seed}
                className="flex items-center gap-1 text-[10.5px] text-ink-soft underline decoration-paper-line underline-offset-2 hover:text-ink"
                title="Embed all the built-in words so neighbour and analogy searches have a vocabulary to answer from"
              >
                <Database size={10} />
                {seedState === 'working' ? 'seeding…' : 'seed index'}
              </button>
            ) : null
          }
        >
          <SourcePicker
            sources={meta.sources}
            value={sourceId}
            onChange={(id) => {
              setSourceId(id)
              setFocus(null)
              setAxisWord('')
              setCompareWord('')
              setSeedState('')
            }}
          />
          {seedState && seedState !== 'working' ? (
            <p className="mt-2 text-[10.5px] leading-snug text-ink-soft">{seedState}</p>
          ) : null}
        </Section>

        <Section title="Words">
          <WordInput
            words={words}
            onChange={(next) => {
              setWords(next)
              setActivePreset('')
            }}
            disabled={demo}
            disabledReason="Adding your own words needs a model to embed them. Start the backend and reload — until then the built-in sets below are live."
            supportsPhrases={source?.supports_phrases}
            missing={scene?.missing}
          />
        </Section>

        <Section title="Word sets" hint={presetLookFor || undefined}>
          <PresetList
            presets={meta.presets}
            sourceId={sourceId}
            active={activePreset}
            onLoad={loadPreset}
          />
        </Section>

        {!demo && meta.sampler?.length ? (
          <Section title="Try a word">
            <Sampler words={meta.sampler} onAdd={addWord} disabled={demo} />
          </Section>
        ) : null}

        <Section title="Vector arithmetic">
          <Arithmetic
            analogies={meta.analogies}
            source={sourceId}
            client={client}
            onAdd={addWord}
            goodAtAnalogies={source?.good_at_analogies}
          />
        </Section>
      </aside>

      {/* ---------------- Viewport ---------------- */}
      <main className="workspace-main">
        <LensControls
          lens={lens} onLens={setLens} words={sceneWords}
          reference={reference} guide={guide} comparison={comparison}
          onReference={setFocus} onGuide={setAxisWord} onCompare={setCompareWord}
        />
        <div id="embedding-surface" role="tabpanel" aria-label={lens === 'map' ? '3D map' : lens === 'axes' ? 'Word axes' : 'Contrast'} className="embedding-surface">
          {scene?.points?.length && lens !== 'map' ? (
            <EmbeddingLens
              lens={lens} scene={scene} reference={reference} guide={guide}
              comparison={comparison} onCompare={setCompareWord}
              hover={hover} onHover={setHover} sourceDims={source?.dims}
            />
          ) : scene?.points?.length ? (
            <Viewport
              points={scene.points}
              colourFor={colourFor}
              markFor={markFor}
              focus={reference}
              comparison={comparison}
              hover={hover}
              onFocus={(word) => { if (word) setFocus(word) }}
              onHover={setHover}
              edges={edges}
              showLabels={showLabels}
              method={methodId}
              projectionMeta={scene.projection}
              sourceDims={source?.dims}
              reducedMotion={reducedMotion}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-vacuum px-8">
              <p className="max-w-sm text-center text-[13px] leading-relaxed text-glow-soft">
                {sceneError ||
                  (busy
                    ? 'Embedding…'
                    : 'Pick a word set, or type a word into the rail, and it will appear here.')}
              </p>
            </div>
          )}

          {/* Status line over the view. Kept to one line so it never becomes a
              panel competing with the thing it describes. */}
          <div className={`pointer-events-none absolute left-0 top-0 w-full items-start justify-between gap-3 p-3 ${lens === 'map' ? 'flex' : 'hidden'}`}>
            <div className="flex flex-col gap-1.5">
              {busy ? (
                <span className="pointer-events-auto flex items-center gap-1.5 rounded-[3px] bg-vacuum/85 px-2 py-1 text-[11px] text-glow-soft">
                  <Loader2 size={11} className="animate-spin" />
                  {method?.deterministic === false ? 'fitting' : 'projecting'}…
                </span>
              ) : null}
              {sceneError && scene ? (
                <span className="pointer-events-auto flex max-w-sm items-start gap-1.5 rounded-[3px] bg-vacuum/85 px-2 py-1 text-[11px] leading-snug text-glow-soft">
                  <AlertCircle size={11} className="mt-[2px] shrink-0" />
                  {sceneError}
                </span>
              ) : null}
              {scene?.notes?.map((note) => (
                <span
                  key={note}
                  className="pointer-events-auto flex max-w-md items-start gap-1.5 rounded-[3px] bg-vacuum/85 px-2 py-1 text-[11px] leading-snug text-glow-soft"
                >
                  <AlertCircle size={11} className="mt-[2px] shrink-0" />
                  {note}
                </span>
              ))}
            </div>

            <div className="pointer-events-auto flex shrink-0 gap-1">
              <ViewToggle on={showLabels} onClick={() => setShowLabels((v) => !v)} label="Word labels" icon={Type} />
              <ViewToggle on={showEdges} onClick={() => setShowEdges((v) => !v)} label="Neighbor connections" icon={Network} />
            </div>
          </div>
          {lens === 'map' && scene ? <div className="map-caption"><strong>{method?.label}</strong><span>{scene.points.length} words / {source?.dims}D to 3D</span></div> : null}
        </div>

        {lens === 'map' ? <MethodTabs
          methods={meta.methods}
          value={methodId}
          onChange={setMethodId}
          scores={methodScores}
          busy={busy}
        /> : null}

        {lens === 'map' && method?.params?.length ? (
          <div className="border-t border-white/10 bg-vacuum px-3 py-2.5">
            <MethodParams
              method={method}
              values={paramsByMethod[methodId]}
              sourceDims={source?.dims}
              disabled={busy}
              onChange={(paramId, value) =>
                setParamsByMethod((prev) => ({
                  ...prev,
                  [methodId]: { ...prev[methodId], [paramId]: value },
                }))
              }
            />
          </div>
        ) : null}
      </main>

      {/* ---------------- Readout column ---------------- */}
      <aside className="evidence-rail rail-scroll" aria-label="Embedding evidence">
        {reference ? (
          <Inspector
            word={reference}
            comparison={comparison}
            scene={scene}
            client={client}
            source={sourceId}
            sourceDims={source?.dims}
            method={method}
            onCompare={setCompareWord}
            onAdd={addWord}
          />
        ) : null}

        {lens === 'map' ? <details className="evidence-details"><summary>3D projection quality</summary><Section title={method?.label}>
          <MetricPanel meta={scene?.projection} method={method} sourceDims={source?.dims} />
        </Section></details> : null}

        {activeLexicon ? (
          <details className="evidence-details" open>
            <summary>Meaning or language</summary>
            <Section
              title="Meaning or language"
              hint={
                source?.cross_lingual_note ||
                'How this model came by whatever cross-lingual ability it has.'
              }
            >
              <Alignment
                client={client}
                source={sourceId}
                lexicon={activeLexicon}
                // The comparison needs a native source to start from; asking
                // for the twin of a twin is not a question.
                canPivot={!source?.pivot}
              />
            </Section>
          </details>
        ) : null}

        {reference ? (
          <details className="evidence-details">
            <summary>Dimensions of “{reference}”</summary>
            <Section
              title="Dimensions"
              hint="Individually meaningless, collectively not quite. Which of the model's dimensions this word drives hardest, and who drives the same ones."
            >
              <Dimensions
                client={client}
                source={sourceId}
                word={reference}
                words={sceneWords}
                canProfile={Boolean(client?.capabilities?.canProfileDimensions)}
              />
            </Section>
          </details>
        ) : null}

        {lens === 'map' ? <details className="evidence-details"><summary>Map appearance</summary><Section title="Colour">
          <div className="mb-2.5 flex gap-1">
            {[
              ['similarity', 'by similarity'],
              ['cluster', 'by group'],
              // Only offered for the concept-by-language grids, which are the
              // only word sets where a language and a meaning exist to colour
              // by. Flipping between these two is the whole visual argument.
              ...(activeLexicon
                ? [
                    ['language', 'by language'],
                    ['concept', 'by meaning'],
                  ]
                : []),
              ['plain', 'none'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={colourMode === mode}
                onClick={() => setColourMode(mode)}
                className={[
                  'flex-1 rounded-[3px] border px-1.5 py-1 text-[10.5px] transition-colors',
                  colourMode === mode
                    ? 'border-signal bg-signal/10 text-ink'
                    : 'border-paper-line bg-paper-sunk/60 text-ink-soft hover:border-ink-mute',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {colourMode === 'cluster' ? (
            <label className="mb-2.5 flex items-center gap-2">
              <span className="shrink-0 text-[11px] text-ink-soft">
                <Term id="cluster">Groups</Term>
              </span>
              <input
                type="range"
                min={2}
                max={8}
                step={1}
                value={clusterCount}
                onChange={(event) => setClusterCount(Number(event.target.value))}
                className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-paper-sunk accent-signal"
              />
              <span className="tnum w-4 text-right text-[11px] text-ink">{clusterCount}</span>
            </label>
          ) : null}

          <Legend
            mode={colourMode}
            focus={focus}
            clusterCount={clusterCount}
            clusterMembers={clusterMembers}
            groups={grouping?.groups}
          />
        </Section></details> : null}

        {scene?.matrix ? (
          <Section title="Every pair">
            <Matrix
              words={scene.points.map((p) => p.word)}
              matrix={scene.matrix}
              focus={focus}
              onFocus={setFocus}
              onHover={setHover}
            />
          </Section>
        ) : null}

        {scene?.top_pairs?.length ? (
          <Section title="Extremes">
            <Extremes pairs={scene.top_pairs} onFocus={setFocus} />
          </Section>
        ) : null}

        {/* Last, and closed: a lookup rather than a readout. Every number in
            this rail has a one-sentence version on its own label; this is
            where the paragraph lives for anyone who wants it. */}
        <details className="evidence-details">
          <summary>What these words mean</summary>
          <Section
            title="Reference"
            hint="Every term the interface uses. The short version is on each label — click one to expand it in place."
          >
            <Reference />
          </Section>
        </details>
      </aside>
      </div>
    </div>
    </GlossaryProvider>
  )
}

function ViewToggle({ on, onClick, label, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={[
        'flex h-8 w-8 items-center justify-center rounded-[3px] transition-colors',
        on ? 'bg-white/15 text-white' : 'bg-vacuum/85 text-glow-soft/60 hover:text-glow-soft',
      ].join(' ')}
    >
      <Icon size={15} />
    </button>
  )
}
