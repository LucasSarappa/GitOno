import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { CommitInfo } from '../../../shared/types'
import { absoluteDate, relativeDate, shortSha } from '../lib/format'
import type { Graph } from '../lib/graph'
import type { RefLabel } from '../lib/refs'
import { Avatar } from './Avatar'
import { CommitGraphCell, LANE_WIDTH, laneColor, ROW_HEIGHT } from './CommitGraphCell'

const HEADER_HEIGHT = 28
const MAX_VISIBLE_LANES = 20
/** Filas extra que se dibujan fuera de la vista, para que el scroll se vea fluido. */
const OVERSCAN = 12
const MAX_PILLS = 3

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

interface Props {
  commits: CommitInfo[]
  graph: Graph
  labels: Map<string, RefLabel[]>
  head: string | null
  selectedSha: string | null
  /** Commits que coinciden con la búsqueda; null si no hay búsqueda activa. */
  matches: ReadonlySet<string> | null
  scrollRequest: ScrollRequest | null
  /** Resumen de la fila de cambios sin commitear, si está en la lista. */
  wip: WipSummary | null
  onSelect(sha: string, viaKeyboard: boolean): void
  onNearEnd(): void
}

/**
 * Lista virtualizada: solo se dibujan las filas visibles, así el historial de repos
 * grandes (decenas de miles de commits) se mueve igual de rápido.
 */
export function CommitList({
  commits,
  graph,
  labels,
  head,
  selectedSha,
  matches,
  scrollRequest,
  wip,
  onSelect,
  onNearEnd
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)

  useLayoutEffect(() => {
    const viewport = viewportRef.current!
    const observer = new ResizeObserver(() => setViewportHeight(viewport.clientHeight))
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
  const graphWidth = Math.max(lanes * LANE_WIDTH + 8, 76)
  const template = `${graphWidth}px minmax(0, 1fr) 170px 120px 72px`

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
    const dimmed = matches !== null && !matches.has(commit.sha)
    if (commit.sha === WIP_SHA && wip) {
      rows.push(
        <div
          key={WIP_SHA}
          className={`commit-row commit-row--wip${selected ? ' commit-row--selected' : ''}${dimmed ? ' commit-row--dimmed' : ''}`}
          style={{ transform: `translateY(${index * ROW_HEIGHT}px)`, gridTemplateColumns: template }}
          onClick={() => onSelect(WIP_SHA, false)}
          aria-selected={selected}
          role="row"
        >
          <CommitGraphCell row={row} lanes={lanes} isHead={false} isMerge={false} isVirtual />
          <div className="commit-row__message">
            <span className="commit-row__wip">// WIP</span>
            <span className="commit-row__subject">{wipSummary(wip)}</span>
          </div>
        </div>
      )
      continue
    }
    rows.push(
      <div
        key={commit.sha}
        className={`commit-row${selected ? ' commit-row--selected' : ''}${dimmed ? ' commit-row--dimmed' : ''}`}
        style={{ transform: `translateY(${index * ROW_HEIGHT}px)`, gridTemplateColumns: template }}
        onClick={() => onSelect(commit.sha, false)}
        aria-selected={selected}
        role="row"
      >
        <CommitGraphCell row={row} lanes={lanes} isHead={commit.sha === head} isMerge={commit.parents.length > 1} />
        <div className="commit-row__message">
          <RefPills labels={labels.get(commit.sha)} color={laneColor(row.color)} />
          <span className="commit-row__subject" title={commit.subject}>
            {commit.subject}
          </span>
        </div>
        <div className="commit-row__author" title={`${commit.authorName} <${commit.authorEmail}>`}>
          <Avatar name={commit.authorName} size={18} />
          <span>{commit.authorName}</span>
        </div>
        <div className="commit-row__date" title={absoluteDate(commit.authorDate)}>
          {relativeDate(commit.authorDate)}
        </div>
        <div className="commit-row__sha">{shortSha(commit.sha)}</div>
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
        <span>Gráfico</span>
        <span>Mensaje</span>
        <span>Autor</span>
        <span>Fecha</span>
        <span>SHA</span>
      </div>
      <div className="commit-list__rows" style={{ height: commits.length * ROW_HEIGHT }}>
        {rows}
      </div>
    </div>
  )
}

function RefPills({ labels, color }: { labels: RefLabel[] | undefined; color: string }) {
  if (!labels || labels.length === 0) return null
  const visible = labels.slice(0, MAX_PILLS)
  const hidden = labels.slice(MAX_PILLS)
  return (
    <>
      {visible.map((label) => (
        <span
          key={label.key}
          className={`ref-pill ref-pill--${label.kind}${label.current ? ' ref-pill--current' : ''}`}
          style={{ '--pill-color': color } as CSSProperties}
          title={pillTitle(label)}
        >
          {label.current && label.kind !== 'head' && <span aria-hidden>✓ </span>}
          {label.kind === 'tag' && <span aria-hidden>◆ </span>}
          {label.label}
          {label.remotes.length > 0 && <span className="ref-pill__remotes">{label.remotes.join(' ')}</span>}
        </span>
      ))}
      {hidden.length > 0 && (
        <span className="ref-pill ref-pill--more" title={hidden.map((l) => l.label).join('\n')}>
          +{hidden.length}
        </span>
      )}
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
  if (label.remotes.length > 0) title += `\nTambién en: ${label.remotes.join(', ')}`
  return title
}
