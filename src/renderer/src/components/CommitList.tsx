import { ArrowRight, Check, Cloud, GitBranchPlus, GitMerge, GripVertical, Laptop, LocateFixed, Minus, Pencil, Plus, Tag, TriangleAlert } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import type { CommitInfo } from '../../../shared/types'
import { clampWidth, COLUMN_LABELS, gridTemplate, layoutColumns, MOVABLE, moveColumn, type ColumnId, type ColumnsConfig } from '../lib/columns'
import { absoluteDate, relativeDate, shortSha } from '../lib/format'
import { childrenOf, nearestBranch } from '../lib/ghost'
import type { Graph } from '../lib/graph'
import type { RefLabel } from '../lib/refs'
import { Avatar } from './Avatar'
import { CommitGraphCell, GRAPH_PAD, LANE_WIDTH, LANE_WIDTH_AVATARS, laneColor, laneX, ROW_HEIGHT } from './CommitGraphCell'

const HEADER_HEIGHT = 30
const MAX_VISIBLE_LANES = 20
/** Filas extra que se dibujan fuera de la vista, para que el scroll se vea fluido. */
const OVERSCAN = 12
const AVATAR_SIZE = 20

/** SHA de la fila de cambios sin commitear. No es un SHA real, así que nunca choca con un commit. */
export const WIP_SHA = 'wip'

/** Tipo de dato al arrastrar una rama o tag (para soltarla sobre otra, como en GitKraken). */
export const REF_DRAG_TYPE = 'application/x-gitono-ref'

export interface WipSummary {
  staged: number
  unstaged: number
  conflicted: number
  /** Archivos distintos por tipo de cambio, para los íconos de la fila. */
  modified: number
  added: number
  deleted: number
  renamed: number
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

/** Dónde abrir un menú: la posición del mouse o, desde el teclado, el rectángulo de la fila. */
export type MenuAnchor = { clientX: number; clientY: number } | DOMRect

/** Lo que se puede hacer con una etiqueta (en la columna, la lista desplegada o la rama fantasma). */
interface PillHandlers {
  onSelectRef(ref: string): void
  onRefMenu(ref: string, at: MenuAnchor): void
  onRefDoubleClick(ref: string): void
  onRefDrop(source: string, target: string, at: MenuAnchor): void
}

interface Props extends PillHandlers {
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
  columns: ColumnsConfig
  /** Los nodos del gráfico son la foto del autor. */
  graphAvatars: boolean
  onColumnsChange(columns: ColumnsConfig): void
  onSelect(sha: string, viaKeyboard: boolean): void
  onNearEnd(): void
  onRowMenu(sha: string, at: MenuAnchor): void
  onHeaderMenu(at: MenuAnchor): void
  /** Agarradera para arrastrar el panel del gráfico a otro lugar. */
  onDragPanel?(e: PointerEvent<HTMLElement>): void
}

/**
 * Lista virtualizada: solo se dibujan las filas visibles, así el historial de repos
 * grandes (decenas de miles de commits) se mueve igual de rápido.
 */
export function CommitList(props: Props) {
  const { commits, graph, labels, head, selectedSha, matches, lineage, selectedRef, scrollRequest, wip, columns, graphAvatars } = props
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)
  const [viewportWidth, setViewportWidth] = useState(900)
  const [hoverSha, setHoverSha] = useState<string | null>(null)

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
    if (commits.length > 0 && end >= commits.length - OVERSCAN) props.onNearEnd()
  }, [end, commits.length, props.onNearEnd])

  // Para la rama fantasma: hijos de cada commit y su carril.
  const children = useMemo(() => childrenOf(commits.filter((c) => c.sha !== WIP_SHA)), [commits])
  const indexBySha = useMemo(() => new Map(commits.map((c, i) => [c.sha, i])), [commits])
  const columnOf = (sha: string) => {
    const index = indexBySha.get(sha)
    return index === undefined ? undefined : graph.rows[index]?.column
  }
  const ghostFor = (sha: string): RefLabel | null => {
    if (sha === WIP_SHA || labels.get(sha)?.some((l) => l.kind === 'local' || l.kind === 'remote')) return null
    return nearestBranch(sha, children, labels, columnOf)
  }

  const laneWidth = graphAvatars ? LANE_WIDTH_AVATARS : LANE_WIDTH
  const lanes = Math.max(1, Math.min(graph.width, MAX_VISIBLE_LANES))
  // Ancho que necesita el gráfico para sus carriles (si no se eligió otro); mínimo, el del título.
  const graphAuto = Math.max(lanes * laneWidth + GRAPH_PAD * 2 + 4, 64)
  const layout = layoutColumns(columns, viewportWidth, graphAuto)
  const template = gridTemplate(layout)
  const refsVisible = layout.some((c) => c.id === 'refs')

  const rowMenuFromKeyboard = () => {
    if (!selectedSha) return
    const row = viewportRef.current?.querySelector(`[data-sha="${selectedSha}"]`)
    if (row) props.onRowMenu(selectedSha, row.getBoundingClientRect())
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      rowMenuFromKeyboard()
      return
    }
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
    props.onSelect(commits[next].sha, true)
  }

  const rowMenu = (sha: string) => (e: MouseEvent) => {
    e.preventDefault()
    props.onSelect(sha, false)
    props.onRowMenu(sha, e)
  }

  // Solo los cuatro manejadores: pasar todas las props pisaría las de cada etiqueta (como `labels`).
  const handlers: PillHandlers = {
    onSelectRef: props.onSelectRef,
    onRefMenu: props.onRefMenu,
    onRefDoubleClick: props.onRefDoubleClick,
    onRefDrop: props.onRefDrop
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
    const isWip = commit.sha === WIP_SHA && wip !== null
    const isMerge = !isWip && commit.parents.length > 1
    const refLabels = isWip ? undefined : labels.get(commit.sha)
    const marker = lineage?.markers.get(commit.sha)
    const avatarNode = graphAvatars && !isWip && !isMerge
    // La rama fantasma solo se busca para la fila con el mouse encima y la elegida.
    const ghost = refsVisible && (commit.sha === hoverSha || selected) ? ghostFor(commit.sha) : null

    const cells: Record<ColumnId, () => ReactNode> = {
      refs: () => (
        <div key="refs" className="commit-row__refs">
          {refLabels && <RefPills labels={refLabels} color={laneColor(row.color)} selectedRef={selectedRef} {...handlers} />}
          {!refLabels && ghost && (
            <Pill label={ghost} color={laneColor(row.color)} selected={ghost.key === selectedRef} ghost {...handlers} />
          )}
        </div>
      ),
      graph: () => (
        <div key="graph" className="commit-row__graph">
          <CommitGraphCell
            row={row}
            lanes={lanes}
            laneWidth={laneWidth}
            isHead={!isWip && commit.sha === head}
            isMerge={isMerge}
            isVirtual={isWip}
            avatarNode={avatarNode}
            hasRefs={Boolean(refLabels) && refsVisible}
            emphasized={inLineage}
          />
          {avatarNode && (
            <span className="graph-avatar" style={{ left: laneX(row.column, laneWidth) - AVATAR_SIZE / 2 }}>
              <Avatar name={commit.authorName} email={commit.authorEmail} size={AVATAR_SIZE} />
            </span>
          )}
        </div>
      ),
      message: () =>
        isWip ? (
          <div key="message" className="commit-row__message">
            <span className="commit-row__wip">// WIP</span>
            <WipCounts wip={wip!} />
          </div>
        ) : (
          <div key="message" className="commit-row__message">
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
        ),
      author: () => (
        <div key="author" className="commit-row__author">
          {!isWip && (
            <>
              <Avatar name={commit.authorName} email={commit.authorEmail} size={20} />
              <span>{commit.authorName}</span>
            </>
          )}
        </div>
      ),
      date: () => (
        <div key="date" className="commit-row__date" title={isWip ? undefined : absoluteDate(commit.authorDate)}>
          {!isWip && relativeDate(commit.authorDate)}
        </div>
      ),
      sha: () => (
        <div key="sha" className="commit-row__sha">
          {!isWip && shortSha(commit.sha)}
        </div>
      )
    }

    rows.push(
      <div
        key={commit.sha}
        data-sha={commit.sha}
        className={[...classes, isWip && 'commit-row--wip'].filter(Boolean).join(' ')}
        style={style}
        onClick={() => props.onSelect(commit.sha, false)}
        onContextMenu={rowMenu(commit.sha)}
        onMouseEnter={() => setHoverSha(commit.sha)}
        aria-selected={selected}
        role="row"
      >
        {layout.map((c) => cells[c.id]())}
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
      onMouseLeave={() => setHoverSha(null)}
      onKeyDown={onKeyDown}
    >
      <ColumnHeader layout={layout} columns={columns} onChange={props.onColumnsChange} onMenu={props.onHeaderMenu} onDragPanel={props.onDragPanel} />
      <div className="commit-list__rows" style={{ height: commits.length * ROW_HEIGHT }}>
        {rows}
      </div>
    </div>
  )
}

/** Íconos con la cantidad de archivos por tipo de cambio, como en GitKraken. */
function WipCounts({ wip }: { wip: WipSummary }) {
  const items: { count: number; kind: string; Icon: typeof Plus; label: string }[] = [
    { count: wip.conflicted, kind: 'conflict', Icon: TriangleAlert, label: 'con conflictos' },
    { count: wip.modified, kind: 'modified', Icon: Pencil, label: 'modificados' },
    { count: wip.added, kind: 'added', Icon: Plus, label: 'nuevos' },
    { count: wip.deleted, kind: 'deleted', Icon: Minus, label: 'borrados' },
    { count: wip.renamed, kind: 'renamed', Icon: ArrowRight, label: 'renombrados' }
  ]
  return (
    <span className="wip-counts" title={wipSummary(wip)} aria-label={wipSummary(wip)}>
      {items
        .filter((i) => i.count > 0)
        .map(({ count, kind, Icon, label }) => (
          <span key={kind} className={`wip-count wip-count--${kind}`} title={`${count} ${label}`}>
            <Icon size={12} strokeWidth={2.25} aria-hidden />
            {count}
          </span>
        ))}
    </span>
  )
}

/**
 * Encabezado de las columnas: arrastrar el borde cambia el ancho, arrastrar el título las reordena
 * y el clic derecho muestra cuáles ver.
 */
function ColumnHeader({
  layout,
  columns,
  onChange,
  onMenu,
  onDragPanel
}: {
  layout: { id: ColumnId; width: number | null }[]
  columns: ColumnsConfig
  onChange(columns: ColumnsConfig): void
  onMenu(at: MenuAnchor): void
  onDragPanel?(e: PointerEvent<HTMLElement>): void
}) {
  const resize = useRef<{ id: ColumnId; x: number; width: number; sign: 1 | -1 } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: ColumnId; after: boolean } | null>(null)

  /** El borde entre dos columnas cambia la de la izquierda; si esa es el mensaje (flexible), la de la derecha. */
  const startResize = (index: number) => (e: PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const left = layout[index]
    const right = layout[index + 1]
    const target = left.width !== null ? left : right
    if (!target || target.width === null) return
    const cell = (e.currentTarget.parentElement as HTMLElement).parentElement!.querySelectorAll('.commit-list__head')[layout.indexOf(target)] as HTMLElement
    resize.current = { id: target.id, x: e.clientX, width: cell.getBoundingClientRect().width, sign: target === left ? 1 : -1 }
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.classList.add('resizing')
  }
  const onResizeMove = (e: PointerEvent<HTMLSpanElement>) => {
    const current = resize.current
    if (!current) return
    const width = clampWidth(current.id, current.width + current.sign * (e.clientX - current.x))
    onChange({ ...columns, widths: { ...columns.widths, [current.id]: width } })
  }
  const endResize = () => {
    resize.current = null
    document.body.classList.remove('resizing')
  }

  const onDragOver = (id: ColumnId) => (e: DragEvent<HTMLDivElement>) => {
    if (!MOVABLE.includes(id) || !e.dataTransfer.types.includes(COLUMN_DRAG_TYPE)) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    setDropTarget({ id, after: e.clientX > rect.left + rect.width / 2 })
  }
  const onDrop = (id: ColumnId) => (e: DragEvent<HTMLDivElement>) => {
    const dragged = e.dataTransfer.getData(COLUMN_DRAG_TYPE) as ColumnId
    setDropTarget(null)
    if (!dragged) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    onChange(moveColumn(columns, dragged, id, e.clientX > rect.left + rect.width / 2))
  }

  return (
    <div
      className="commit-list__header"
      style={{ gridTemplateColumns: gridTemplate(layout), height: HEADER_HEIGHT }}
      role="row"
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu(e)
      }}
    >
      {onDragPanel && (
        <span className="dock-grip dock-grip--header" title="Arrastrá para mover el gráfico" aria-hidden onPointerDown={onDragPanel}>
          <GripVertical size={13} strokeWidth={1.75} />
        </span>
      )}
      {layout.map((column, index) => {
        const movable = MOVABLE.includes(column.id)
        const marker = dropTarget?.id === column.id ? (dropTarget.after ? ' commit-list__head--drop-after' : ' commit-list__head--drop-before') : ''
        return (
          <div
            key={column.id}
            className={`commit-list__head${movable ? ' commit-list__head--movable' : ''}${marker}`}
            role="columnheader"
            draggable={movable}
            title={movable ? 'Arrastrá para mover la columna · clic derecho para elegir columnas' : 'Clic derecho para elegir columnas'}
            onDragStart={(e) => {
              e.dataTransfer.setData(COLUMN_DRAG_TYPE, column.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={onDragOver(column.id)}
            onDragLeave={() => setDropTarget(null)}
            onDrop={onDrop(column.id)}
          >
            <span className="commit-list__head-label">{COLUMN_LABELS[column.id]}</span>
            {index < layout.length - 1 && (
              <span
                className="col-resizer"
                role="separator"
                aria-orientation="vertical"
                aria-label={`Ancho de ${COLUMN_LABELS[column.id]}`}
                onPointerDown={startResize(index)}
                onPointerMove={onResizeMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onDoubleClick={() => {
                  // Doble clic: la columna vuelve a su ancho original (el gráfico, a sus carriles).
                  const target = column.width !== null ? column : layout[index + 1]
                  const widths = { ...columns.widths }
                  delete widths[target.id]
                  onChange({ ...columns, widths })
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const COLUMN_DRAG_TYPE = 'application/x-gitono-column'

/**
 * Etiquetas de un commit. Se ve la más importante y un "+N"; al apoyar el mouse se despliegan todas
 * hacia abajo, como en GitKraken, y cada una tiene su menú y se puede arrastrar.
 */
function RefPills({ labels, color, selectedRef, ...handlers }: { labels: RefLabel[]; color: string; selectedRef: string | null } & PillHandlers) {
  const [first, ...rest] = labels
  const anchorRef = useRef<HTMLDivElement>(null)
  const [stack, setStack] = useState<DOMRect | null>(null)
  const timer = useRef(0)

  const open = () => {
    if (rest.length === 0) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => anchorRef.current && setStack(anchorRef.current.getBoundingClientRect()), 120)
  }
  const close = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStack(null), 160)
  }

  // Al hacer scroll la lista se mueve y la desplegada quedaría en otro lugar: se cierra.
  useEffect(() => {
    if (!stack) return
    const onScroll = () => setStack(null)
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [stack])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <div className="ref-pills" ref={anchorRef} onMouseEnter={open} onMouseLeave={close}>
      <Pill label={first} color={color} selected={first.key === selectedRef} {...handlers} />
      {rest.length > 0 && (
        <span className="ref-pill ref-pill--more" title={rest.map(pillTitle).join('\n')}>
          +{rest.length}
        </span>
      )}
      {stack &&
        createPortal(
          <div
            className="ref-stack"
            style={{ top: stack.top - 4, right: window.innerWidth - stack.right - 4 }}
            onMouseEnter={() => window.clearTimeout(timer.current)}
            onMouseLeave={close}
          >
            {labels.map((label) => (
              <Pill key={label.key} label={label} color={color} selected={label.key === selectedRef} {...handlers} />
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

/** Una etiqueta de rama, tag o HEAD. Fantasma: la rama más cercana que contiene un commit sin etiquetas. */
function Pill({
  label,
  color,
  selected,
  ghost = false,
  onSelectRef,
  onRefMenu,
  onRefDoubleClick,
  onRefDrop
}: { label: RefLabel; color: string; selected: boolean; ghost?: boolean } & PillHandlers) {
  const [dragOver, setDragOver] = useState(false)
  const isRef = label.kind !== 'head'
  // El fantasma nunca se pinta como rama actual: es solo una pista tenue.
  const current = label.current && !ghost
  const classes = [
    'ref-pill',
    `ref-pill--${label.kind}`,
    current && 'ref-pill--current',
    selected && 'ref-pill--selected',
    ghost && 'ref-pill--ghost',
    dragOver && 'ref-pill--drop'
  ]
  const hint = isRef ? '\nDoble clic: checkout · arrastrala sobre otra rama para mergear o rebasear' : ''
  return (
    <button
      className={classes.filter(Boolean).join(' ')}
      style={{ '--pill-color': color } as CSSProperties}
      title={(ghost ? `Rama más cercana que contiene este commit: ${label.label}` : pillTitle(label)) + hint}
      draggable={isRef}
      onClick={(e) => {
        e.stopPropagation()
        if (isRef) onSelectRef(label.key)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (isRef && !label.current) onRefDoubleClick(label.key)
      }}
      onContextMenu={(e) => {
        if (!isRef) return
        e.preventDefault()
        e.stopPropagation()
        onRefMenu(label.key, e)
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData(REF_DRAG_TYPE, label.key)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!isRef || !e.dataTransfer.types.includes(REF_DRAG_TYPE)) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false)
        const source = e.dataTransfer.getData(REF_DRAG_TYPE)
        if (!isRef || !source || source === label.key) return
        e.preventDefault()
        onRefDrop(source, label.key, e)
      }}
    >
      {current && label.kind !== 'head' && <Check size={11} strokeWidth={2.75} aria-hidden />}
      {label.kind === 'head' && <LocateFixed size={11} strokeWidth={2.25} aria-hidden />}
      {label.kind === 'tag' && <Tag size={11} strokeWidth={2.25} aria-hidden />}
      <span className="ref-pill__name">{label.label}</span>
      {(label.kind === 'local' || label.kind === 'remote') && (
        <span className="ref-pill__icons" aria-hidden>
          {label.kind === 'local' && <Laptop size={11} strokeWidth={2} />}
          {(label.kind === 'remote' || label.remotes.length > 0) && <Cloud size={11} strokeWidth={2} />}
        </span>
      )}
    </button>
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
