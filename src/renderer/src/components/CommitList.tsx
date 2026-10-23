import { Check, Cloud, GitBranchPlus, GitMerge, Laptop, LocateFixed, Tag } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { CommitInfo } from '../../../shared/types'
import { absoluteDate, relativeDate, shortSha } from '../lib/format'
import type { Graph } from '../lib/graph'
import type { RefLabel } from '../lib/refs'
import { Avatar } from './Avatar'
import { CommitGraphCell, LANE_WIDTH, laneColor, ROW_HEIGHT } from './CommitGraphCell'

const HEADER_HEIGHT = 30
const MAX_VISIBLE_LANES = 20
/** Filas extra que se dibujan fuera de la vista, para que el scroll se vea fluido. */
const OVERSCAN = 12

/** SHA de la fila de cambios sin commitear. No es un SHA real, así que nunca choca con un commit. */
export const WIP_SHA = 'wip'

export interface WipSummary {
  staged: number
  unstaged: number
  conflicted: number
}

export interface ScrollRequest {
  sha: string
  align: 'center' | 'nearest'
  /** Cambia en cada pedido, para poder repetir el mismo SHA. */
  nonce: number
}

/** Marca en un commit del linaje de la rama elegida. */
export interface LineageMarker {
  kind: 'fork' | 'merge'
  text: string
}

export interface LineageView {
  /** Commits que forman parte de la historia de la rama (propios, origen y merge). */
  highlight: ReadonlySet<string>
  markers: ReadonlyMap<string, LineageMarker>
}

interface Props {
  commits: CommitInfo[]
  graph: Graph
  labels: Map<string, RefLabel[]>
  head: string | null
  selectedSha: string | null
  /** Commits que coinciden con la búsqueda; null si no hay búsqueda activa. */
  matches: ReadonlySet<string> | null
  /** Linaje de la rama elegida: se resalta y el resto se atenúa. */
  lineage: LineageView | null
  /** Rama elegida (su etiqueta se marca). */
  selectedRef: string | null
  scrollRequest: ScrollRequest | null
  /** Resumen de la fila de cambios sin commitear, si está en la lista. */
  wip: WipSummary | null
  onSelect(sha: string, viaKeyboard: boolean): void
  onSelectRef(ref: string): void
  onNearEnd(): void
}

/**
 * Lista virtualizada: solo se dibujan las filas visibles, así el historial de repos
 * grandes (decenas de miles de commits) se mueve igual de rápido.
 */
export function CommitList(props: Props) {
  const { commits, graph, labels, head, selectedSha, matches, lineage, selectedRef, scrollRequest, wip, onSelect, onSelectRef, onNearEnd } = props
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)
  const [viewportWidth, setViewportWidth] = useState(900)

  useLayoutEffect(() => {
    const viewport = viewportRef.current!
    const observer = new ResizeObserver(() => {
      setViewportHeight(viewport.clientHeight)
      setViewportWidth(viewport.clientWidth)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!scrollRequest || !viewport) return
    const index = commits.findIndex((c) => c.sha === scrollRequest.sha)
    if (index === -1) return
    const rowTop = index * ROW_HEIGHT
    const rowsHeight = viewport.clientHeight - HEADER_HEIGHT
    if (scrollRequest.align === 'center') viewport.scrollTop = rowTop - rowsHeight / 2 + ROW_HEIGHT / 2
    else if (rowTop < viewport.scrollTop) viewport.scrollTop = rowTop
    else if (rowTop + ROW_HEIGHT > viewport.scrollTop + rowsHeight) viewport.scrollTop = rowTop + ROW_HEIGHT - rowsHeight
  }, [scrollRequest, commits])

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(commits.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)

  useEffect(() => {
    if (commits.length > 0 && end >= commits.length - OVERSCAN) onNearEnd()
  }, [end, commits.length, onNearEnd])

  const lanes = Math.max(1, Math.min(graph.width, MAX_VISIBLE_LANES))
  // Ancho mínimo para que entre el título de la columna aunque haya un solo carril.
  const graphWidth = Math.max(lanes * LANE_WIDTH + 10, 64)
  // El mensaje se queda con todo el espacio que sobra. Si no le quedan al menos 240 px, se ocultan
  // columnas en este orden: SHA, fecha y autor.
  const fixed = 156 + graphWidth
  const show = {
    author: viewportWidth - fixed - 144 >= 240,
    date: viewportWidth - fixed - 144 - 112 >= 240,
    sha: viewportWidth - fixed - 144 - 112 - 72 >= 240
  }
  const template = [
    '156px',
    `${graphWidth}px`,
    'minmax(0, 1fr)',
    show.author && '144px',
    show.date && '112px',
    show.sha && '72px'
  ]
    .filter(Boolean)
    .join(' ')

  const onKeyDown = (e: KeyboardEvent) => {
    const pageSize = Math.max(1, Math.floor((viewportHeight - HEADER_HEIGHT) / ROW_HEIGHT) - 1)
    const steps: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: pageSize,
      PageUp: -pageSize,
      Home: -commits.length,
      End: commits.length
    }
    const step = steps[e.key]
    if (step === undefined || commits.length === 0) return
    e.preventDefault()
    const index = commits.findIndex((c) => c.sha === selectedSha)
    const next = Math.min(commits.length - 1, Math.max(0, (index === -1 ? -1 : index) + step))
    onSelect(commits[next].sha, true)
  }

  const rows = []
  for (let index = start; index < end; index++) {
    const commit = commits[index]
    const row = graph.rows[index]
    const selected = commit.sha === selectedSha
    const inLineage = lineage?.highlight.has(commit.sha) ?? false
    const dimmed =
      commit.sha !== WIP_SHA && ((matches !== null && !matches.has(commit.sha)) || (lineage !== null && !inLineage))
    const classes = ['commit-row', selected && 'commit-row--selected', dimmed && 'commit-row--dimmed', inLineage && 'commit-row--lineage']
    const style = { transform: `translateY(${index * ROW_HEIGHT}px)`, gridTemplateColumns: template }

    if (commit.sha === WIP_SHA && wip) {
      rows.push(
        <div
          key={WIP_SHA}
          className={[...classes, 'commit-row--wip'].filter(Boolean).join(' ')}
          style={style}
          onClick={() => onSelect(WIP_SHA, false)}
          aria-selected={selected}
          role="row"
        >
          <div className="commit-row__refs" />
          <CommitGraphCell row={row} lanes={lanes} isHead={false} isMerge={false} isVirtual />
          <div className="commit-row__message">
            <span className="commit-row__wip">// WIP</span>
            <span className="commit-row__subject">{wipSummary(wip)}</span>
          </div>
        </div>
      )
      continue
    }

    const refLabels = labels.get(commit.sha)
    const marker = lineage?.markers.get(commit.sha)
    rows.push(
      <div
        key={commit.sha}
        className={classes.filter(Boolean).join(' ')}
        style={style}
        onClick={() => onSelect(commit.sha, false)}
        aria-selected={selected}
        role="row"
      >
        <div className="commit-row__refs">
          {refLabels && <RefPills labels={refLabels} color={laneColor(row.color)} selectedRef={selectedRef} onSelectRef={onSelectRef} />}
        </div>
        <CommitGraphCell
          row={row}
          lanes={lanes}
          isHead={commit.sha === head}
          isMerge={commit.parents.length > 1}
          hasRefs={Boolean(refLabels)}
          emphasized={inLineage}
        />
        <div className="commit-row__message">
          {marker && (
            <span className={`lineage-mark lineage-mark--${marker.kind}`}>
              {marker.kind === 'fork' ? <GitBranchPlus size={12} strokeWidth={2} aria-hidden /> : <GitMerge size={12} strokeWidth={2} aria-hidden />}
              {marker.text}
            </span>
          )}
          <span className="commit-row__subject" title={commit.subject}>
            {commit.subject}
          </span>
        </div>
        {show.author && (
          <div className="commit-row__author">
            <Avatar name={commit.authorName} email={commit.authorEmail} size={20} />
            <span>{commit.authorName}</span>
          </div>
        )}
        {show.date && (
          <div className="commit-row__date" title={absoluteDate(commit.authorDate)}>
            {relativeDate(commit.authorDate)}
          </div>
        )}
        {show.sha && <div className="commit-row__sha">{shortSha(commit.sha)}</div>}
      </div>
    )
  }

  return (
    <div
      ref={viewportRef}
      className="commit-list"
      tabIndex={0}
      role="grid"
      aria-label="Historial de commits"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onKeyDown={onKeyDown}
    >
      <div className="commit-list__header" style={{ gridTemplateColumns: template, height: HEADER_HEIGHT }} role="row">
        <span>Rama / tag</span>
        <span>Gráfico</span>
        <span>Mensaje</span>
        {show.author && <span>Autor</span>}
        {show.date && <span>Fecha</span>}
        {show.sha && <span>SHA</span>}
      </div>
      <div className="commit-list__rows" style={{ height: commits.length * ROW_HEIGHT }}>
        {rows}
      </div>
    </div>
  )
}

/** Etiquetas de la columna izquierda. Entra la más importante; el resto se cuenta y se ve en el tooltip. */
function RefPills({
  labels,
  color,
  selectedRef,
  onSelectRef
}: {
  labels: RefLabel[]
  color: string
  selectedRef: string | null
  onSelectRef(ref: string): void
}) {
  const [first, ...rest] = labels
  return (
    <>
      <button
        className={`ref-pill ref-pill--${first.kind}${first.current ? ' ref-pill--current' : ''}${first.key === selectedRef ? ' ref-pill--selected' : ''}`}
        style={{ '--pill-color': color } as CSSProperties}
        title={[first, ...rest].map(pillTitle).join('\n')}
        onClick={(e) => {
          e.stopPropagation()
          if (first.kind !== 'head') onSelectRef(first.key)
        }}
      >
        <PillIcon label={first} />
        <span className="ref-pill__name">{first.label}</span>
      </button>
      {rest.length > 0 && (
        <span className="ref-pill ref-pill--more" title={rest.map(pillTitle).join('\n')}>
          +{rest.length}
        </span>
      )}
    </>
  )
}

function PillIcon({ label }: { label: RefLabel }) {
  const size = 11
  if (label.kind === 'head') return <LocateFixed size={size} strokeWidth={2.25} aria-hidden />
  if (label.kind === 'tag') return <Tag size={size} strokeWidth={2.25} aria-hidden />
  if (label.kind === 'remote') return <Cloud size={size} strokeWidth={2.25} aria-hidden />
  return (
    <>
      {label.current ? <Check size={size} strokeWidth={2.75} aria-hidden /> : <Laptop size={size} strokeWidth={2.25} aria-hidden />}
      {label.remotes.length > 0 && <Cloud size={size} strokeWidth={2.25} aria-hidden />}
    </>
  )
}

function wipSummary({ staged, unstaged, conflicted }: WipSummary): string {
  const parts = []
  if (conflicted > 0) parts.push(`${conflicted} con conflictos`)
  if (unstaged > 0) parts.push(`${unstaged} sin preparar`)
  if (staged > 0) parts.push(`${staged} ${staged === 1 ? 'preparado' : 'preparados'}`)
  return parts.join(' · ')
}

function pillTitle(label: RefLabel): string {
  const kinds = { local: 'Rama local', remote: 'Rama remota', tag: 'Tag', head: 'HEAD desacoplado' }
  let title = `${kinds[label.kind]}: ${label.label}`
  if (label.current) title += ' (actual)'
  if (label.remotes.length > 0) title += ` · también en ${label.remotes.join(', ')}`
  return title
}
