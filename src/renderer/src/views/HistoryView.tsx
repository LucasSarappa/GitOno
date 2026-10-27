import { ArrowDown, ArrowLeft, ArrowUp, Code, Columns3, Eye, GripVertical, LayoutDashboard, MoreHorizontal, PanelBottomOpen, PanelRightOpen, PanelTopOpen, RotateCcw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type {
  BranchInsight,
  CommitDetails as Details,
  CommitInfo,
  CommitPage,
  FileChange,
  GraphFilter,
  RefInfo,
  RefList,
  RepoInfo,
  StashInfo,
  WorkingArea,
  WorkingFile,
  WorkingTreeStatus
} from '../../../shared/types'
import { api } from '../api'
import { BranchInsightCard } from '../components/BranchInsightCard'
import { CommitDetails } from '../components/CommitDetails'
import {
  CommitList,
  WIP_SHA,
  type LineageMarker,
  type LineageView,
  type MenuAnchor,
  type ScrollRequest,
  type WipSummary
} from '../components/CommitList'
import { tidy, useContextMenu, type MenuItem } from '../components/ContextMenu'
import { DiffView, type DiffOptions } from '../components/DiffView'
import { EmptyState } from '../components/EmptyState'
import { RefsPanel, stashLabel } from '../components/RefsPanel'
import { Splitter } from '../components/Splitter'
import { WorkingFileView } from '../components/WorkingFileView'
import { EMPTY_DRAFT, WorkingTreePanel, type CommitDraft } from '../components/WorkingTreePanel'
import { COLUMN_LABELS, DEFAULT_COLUMNS, normalizeColumns, type ColumnId, type ColumnsConfig } from '../lib/columns'
import { shortSha } from '../lib/format'
import { computeGraph, withStashRows } from '../lib/graph'
import { labelsByCommit } from '../lib/refs'
import { useAppearance } from '../lib/appearance'
import { setDetailsPrefs, useDetailsPrefs } from '../lib/detailsPrefs'
import {
  DEFAULT_LAYOUT,
  defaultSize,
  layoutGrid,
  matchingPreset,
  moveCenter,
  movePanel,
  nearestSide,
  normalizeLayout,
  PANEL_NAMES,
  PRESETS,
  resizePanel,
  setPanelOpen,
  SIDE_NAMES,
  SIZE_LIMITS,
  type DockLayout,
  type PanelId,
  type Placement,
  type Side
} from '../lib/dock'
import { loadSetting, saveSetting } from '../lib/settings'
import type { ActionMenus } from './useRepoActions'

// La pestaña de la izquierda va girada 180°: con el mismo ícono que la derecha, la flecha apunta hacia el gráfico.
const RAIL_ICONS = { left: PanelRightOpen, right: PanelRightOpen, top: PanelTopOpen, bottom: PanelBottomOpen }
import { t, tn } from '../../../shared/i18n'

/** Commits que se cargan por tanda al bajar por el historial. */
const PAGE_SIZE = 1000
/** Mismo límite que acepta el proceso principal (MAX_COMMITS en git/repo.ts). */
const MAX_COMMITS = 50_000
const NO_COMMITS: CommitInfo[] = []

/** Disposición guardada por la v0.5 (solo anchos y paneles abiertos), para no perderla. */
interface OldPanels {
  left: number
  right: number
  leftOpen: boolean
  rightOpen: boolean
}

function loadLayout(): DockLayout {
  const saved = loadSetting<DockLayout | null>('historyLayout', null)
  if (saved) return normalizeLayout(saved)
  const old = loadSetting<OldPanels | null>('historyPanels', null)
  if (!old) return DEFAULT_LAYOUT
  return normalizeLayout({
    docks: [
      { panel: 'refs', side: 'left', size: old.left, open: old.leftOpen },
      { panel: 'details', side: 'right', size: old.right, open: old.rightOpen }
    ]
  })
}

/** Un panel que se está arrastrando para acomodarlo en otro lugar. */
interface DockDrag {
  panel: PanelId | 'center'
  startX: number
  startY: number
  /** Ya se movió lo suficiente como para ser un arrastre (y no un clic). */
  moving: boolean
  target: { side: Side; placement: Placement } | null
}

/** Lo que se muestra en el centro en lugar del gráfico. */
type Open =
  | { kind: 'commit'; change: FileChange; sha: string; parent: string }
  | { kind: 'working'; file: WorkingFile; area: WorkingArea }

/** Qué mostrar en el historial: un commit o stash, el linaje de una rama o los cambios sin commitear. */
export type ShowTarget = { kind: 'commit'; sha: string } | { kind: 'branch'; ref: string } | { kind: 'wip' }

/** Pedido desde afuera (la barra, un menú) de mostrar algo; el nonce permite repetir el mismo pedido. */
export type ShowRequest = ShowTarget & { nonce: number }

interface Props {
  repo: RepoInfo
  /** La vista Historial está a la vista (la búsqueda va a la barra de herramientas solo entonces). */
  active: boolean
  /** Lugar de la barra de herramientas donde va la búsqueda. */
  searchSlot: HTMLElement | null
  refs: RefList
  status: WorkingTreeStatus | null
  /** Sube con cada estado nuevo de la carpeta de trabajo (los diffs locales se releen con él). */
  statusVersion: number
  stashes: StashInfo[]
  /** Ramas ocultas en el gráfico, o las únicas que se muestran. */
  filter: GraphFilter
  onFilterChange(filter: GraphFilter): void
  /** Cambia cuando hay que volver a leer el historial (por ejemplo, después de un fetch). */
  reloadKey: number
  options: DiffOptions
  showRequest: ShowRequest | null
  menus: ActionMenus
  onOptionsChange(options: DiffOptions): void
  onError(message: string): void
  onRefreshStatus(): void
  /** Se llama después de un commit: hay que releer ramas e historial. */
  onRepoMutated(): void
  /** Commit hecho desde el panel de cambios, para poder deshacerlo. */
  onCommitted(before: string | null, after: string): void
  onCheckout(ref: string): void
  onShowAll(): void
  /** Abre la vista Comparar con dos referencias ya elegidas. */
  onCompare(refA: string, refB: string): void
}

export function HistoryView(props: Props) {
  const { repo, active, searchSlot, refs, status, statusVersion, stashes, filter, reloadKey, options, showRequest, menus, onOptionsChange, onError } = props
  const { appearance } = useAppearance()
  const detailsPrefs = useDetailsPrefs()
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [page, setPage] = useState<CommitPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedSha, setSelectedSha] = useState<string | null>(null)
  // Commit que se pidió ver pero todavía no está cargado: se sigue cargando historial hasta encontrarlo.
  const [pendingSha, setPendingSha] = useState<string | null>(null)
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const [query, setQuery] = useState('')
  // Buscar en el código de los commits (git log -S) en vez de en mensaje, autor y SHA.
  const [codeSearch, setCodeSearch] = useState(false)
  const [codeMatches, setCodeMatches] = useState<{ query: string; shas: ReadonlySet<string> } | null>(null)
  const [draft, setDraft] = useState<CommitDraft>(EMPTY_DRAFT)
  // Rama elegida para ver su linaje (de dónde sale, sus commits y dónde se mergeó).
  const [lineageRef, setLineageRef] = useState<string | null>(null)
  const [insight, setInsight] = useState<BranchInsight | null>(null)
  const [layout, setLayout] = useState<DockLayout>(loadLayout)
  const [drag, setDrag] = useState<DockDrag | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [columns, setColumns] = useState<ColumnsConfig>(() => normalizeColumns(loadSetting('historyColumns', { ...DEFAULT_COLUMNS, version: 1 })))
  const nonce = useRef(0)
  // Commit recién creado: se centra en la lista apenas aparezca.
  const scrollWhenLoaded = useRef<string | null>(null)
  const menu = useContextMenu()

  useEffect(() => saveSetting('historyLayout', layout), [layout])
  useEffect(() => saveSetting('historyColumns', columns), [columns])

  const filterKey = JSON.stringify(filter)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.listCommits(repo.root, limit, JSON.parse(filterKey) as GraphFilter).then(
      (result) => {
        if (cancelled) return
        setPage(result)
        setLoading(false)
      },
      (error: Error) => {
        if (cancelled) return
        setLoading(false)
        onError(error.message)
      }
    )
    return () => {
      cancelled = true
    }
  }, [repo.root, limit, reloadKey, filterKey, onError])

  const wip = useMemo((): WipSummary | null => {
    if (!status || status.staged.length + status.unstaged.length + status.conflicted.length === 0) return null
    // Cada archivo cuenta una vez por tipo de cambio, aunque tenga una parte preparada y otra no.
    const kinds = new Map<string, string>()
    for (const file of [...status.staged, ...status.unstaged]) kinds.set(file.path, file.status)
    for (const file of status.conflicted) kinds.delete(file.path)
    const count = (kind: string) => [...kinds.values()].filter((k) => k === kind).length
    return {
      staged: status.staged.length,
      unstaged: status.unstaged.length,
      conflicted: status.conflicted.length,
      modified: count('modified') + count('type-changed'),
      added: count('added') + count('copied'),
      deleted: count('deleted'),
      renamed: count('renamed')
    }
  }, [status])
  const hasWip = wip !== null
  const wipParent = status?.head ?? null

  const commits = page?.commits ?? NO_COMMITS
  const stashBySha = useMemo(() => new Map(stashes.map((s) => [s.sha, s])), [stashes])
  // La fila de cambios sin commitear va arriba de todo, unida al commit actual; las de los stashes,
  // entre los commits, unidas al commit sobre el que se guardaron.
  const rows = useMemo((): CommitInfo[] => {
    const withStashes = withStashRows(commits, stashes, (stash) => ({
      sha: stash.sha,
      parents: [stash.base],
      authorName: '',
      authorEmail: '',
      authorDate: stash.date,
      subject: stashBySha.get(stash.sha)?.message ?? ''
    }))
    if (!hasWip) return withStashes
    const wipRow = { sha: WIP_SHA, parents: wipParent ? [wipParent] : [], authorName: '', authorEmail: '', authorDate: 0, subject: '' }
    return [wipRow, ...withStashes]
  }, [commits, stashes, stashBySha, hasWip, wipParent])
  const graph = useMemo(
    () => computeGraph(rows.map((c) => (c.sha === WIP_SHA || stashBySha.has(c.sha) ? { ...c, virtual: true } : c))),
    [rows, stashBySha]
  )
  const labels = useMemo(() => labelsByCommit(refs.refs, refs.current, refs.head), [refs])
  const indexBySha = useMemo(() => new Map(rows.map((c, i) => [c.sha, i])), [rows])
  const refByName = useMemo(() => new Map(refs.refs.map((r) => [r.ref, r])), [refs])

  const requestScroll = (sha: string, align: ScrollRequest['align']) => setScrollRequest({ sha, align, nonce: ++nonce.current })

  const selectCommit = (sha: string, align: ScrollRequest['align'] | null) => {
    setOpen(null)
    if (!indexBySha.has(sha)) {
      setPendingSha(sha)
      return
    }
    setSelectedSha(sha)
    if (align) requestScroll(sha, align)
  }

  // Al abrir el repo se selecciona el commit actual (HEAD).
  useEffect(() => {
    if (selectedSha || !page || page.commits.length === 0) return
    const initial = refs.head && indexBySha.has(refs.head) ? refs.head : page.commits[0].sha
    setSelectedSha(initial)
    requestScroll(initial, 'center')
  }, [page, selectedSha, refs.head, indexBySha])

  // Si se eligió la fila WIP y ya no quedan cambios (se commitearon o descartaron), se pasa a HEAD.
  useEffect(() => {
    if (selectedSha === WIP_SHA && status && !hasWip) setSelectedSha(status.head)
  }, [selectedSha, status, hasWip])

  useEffect(() => {
    const sha = scrollWhenLoaded.current
    if (sha && indexBySha.has(sha)) {
      scrollWhenLoaded.current = null
      requestScroll(sha, 'center')
    }
  }, [indexBySha])

  useEffect(() => {
    if (!pendingSha || !page || loading) return
    if (indexBySha.has(pendingSha)) {
      setPendingSha(null)
      setSelectedSha(pendingSha)
      requestScroll(pendingSha, 'center')
    } else if (page.hasMore && limit < MAX_COMMITS) {
      setLimit((l) => Math.min(MAX_COMMITS, l + PAGE_SIZE * 5))
    } else {
      setPendingSha(null)
      onError(filter.hidden.length + filter.solo.length > 0 ? t('Ese commit está en una rama oculta del gráfico.') : t('Ese commit no aparece en el historial de ramas y etiquetas cargado.'))
    }
  }, [pendingSha, page, loading, indexBySha, limit, onError, filter])

  // Un archivo local abierto sigue al archivo: si se preparó entero pasa a "preparado", y si ya
  // no tiene cambios se vuelve al gráfico.
  useEffect(() => {
    if (open?.kind !== 'working' || !status) return
    const find = (area: WorkingArea) =>
      (area === 'staged' ? status.staged : [...status.unstaged, ...status.conflicted]).find((f) => f.path === open.file.path)
    const here = find(open.area)
    if (here) {
      if (here.status !== open.file.status || here.oldPath !== open.file.oldPath || here.untracked !== open.file.untracked) {
        setOpen({ kind: 'working', file: here, area: open.area })
      }
      return
    }
    const otherArea: WorkingArea = open.area === 'staged' ? 'unstaged' : 'staged'
    const moved = find(otherArea)
    setOpen(moved ? { kind: 'working', file: moved, area: otherArea } : null)
  }, [status, open])

  const loadMore = useCallback(() => {
    // Solo si lo cargado ya llegó al límite actual: si no, ya hay una tanda en camino.
    const caughtUp = page !== null && page.commits.length >= limit
    if (caughtUp && page.hasMore && !loading && limit < MAX_COMMITS) setLimit((l) => Math.min(MAX_COMMITS, l + PAGE_SIZE))
  }, [page, loading, limit])

  // Esc vuelve del diff al historial (salvo que se esté escribiendo en un campo).
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.key === 'Escape' && !target?.closest('input, textarea')) setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // La búsqueda en el código corre en Git: se espera a que se deje de escribir.
  useEffect(() => {
    const text = query.trim()
    if (!codeSearch || text.length < 2) {
      setCodeMatches(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      api.searchCode(repo.root, text).then(
        (shas) => !cancelled && setCodeMatches({ query: text, shas: new Set(shas) }),
        (error: Error) => !cancelled && onError(error.message)
      )
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [codeSearch, query, repo.root, reloadKey, onError])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    if (codeSearch) return codeMatches?.query === query.trim() ? codeMatches.shas : null
    const found = commits.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.authorName.toLowerCase().includes(q) ||
        c.authorEmail.toLowerCase().includes(q) ||
        c.sha.startsWith(q)
    )
    return new Set(found.map((c) => c.sha))
  }, [commits, query, codeSearch, codeMatches])
  const matchList = useMemo(() => (matches ? commits.filter((c) => matches.has(c.sha)) : NO_COMMITS), [commits, matches])
  const matchPosition = selectedSha && matches?.has(selectedSha) ? matchList.findIndex((c) => c.sha === selectedSha) + 1 : 0

  const goToMatch = (direction: 1 | -1) => {
    if (matchList.length === 0) return
    const current = selectedSha ? (indexBySha.get(selectedSha) ?? -1) : -1
    const position = (c: CommitInfo) => indexBySha.get(c.sha) ?? 0
    const target =
      direction === 1
        ? (matchList.find((c) => position(c) > current) ?? matchList[0])
        : ([...matchList].reverse().find((c) => position(c) < current) ?? matchList[matchList.length - 1])
    selectCommit(target.sha, 'center')
  }

  const onSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      goToMatch(e.shiftKey ? -1 : 1)
    } else if (e.key === 'Escape') {
      setQuery('')
    }
  }

  const openFileFromDetails = (change: FileChange, details: Details) =>
    setOpen({ kind: 'commit', change, sha: details.sha, parent: details.parents[0] ?? '' })

  const onCommitted = (sha: string) => {
    props.onCommitted(status?.head ?? null, sha)
    setOpen(null)
    setSelectedSha(sha)
    scrollWhenLoaded.current = sha
    props.onRefreshStatus()
    props.onRepoMutated()
  }

  // Linaje de la rama elegida: se vuelve a calcular si cambian las ramas (fetch, commit…).
  useEffect(() => {
    if (!lineageRef) return
    let cancelled = false
    api.branchInsight(repo.root, lineageRef).then(
      (result) => !cancelled && setInsight(result),
      (error: Error) => {
        if (cancelled) return
        setLineageRef(null)
        onError(error.message)
      }
    )
    return () => {
      cancelled = true
    }
  }, [repo.root, lineageRef, reloadKey, onError])

  // Si la rama elegida desaparece (se borró o renombró), se deja de mostrar su linaje.
  useEffect(() => {
    if (lineageRef && !refByName.has(lineageRef)) setLineageRef(null)
  }, [lineageRef, refByName])

  const showBranch = (ref: string) => {
    setInsight(null)
    setLineageRef(ref)
    const tip = refByName.get(ref)?.target
    if (tip) selectCommit(tip, 'center')
  }
  // Un clic en una rama solo lleva a su commit, como en GitKraken. El linaje (de dónde sale y dónde
  // se mergeó) se pide aparte: clic derecho → "Ver de dónde sale", o el ícono de mira del panel.
  const selectBranch = (ref: string) => {
    const tip = refByName.get(ref)?.target
    if (tip) selectCommit(tip, 'center')
  }
  const selectBranchByName = (name: string) => {
    const ref = refs.refs.find((r) => r.name === name)
    if (ref) selectBranch(ref.ref)
  }

  // Si el stash está en el gráfico se va a su fila; si no (su commit base no está cargado), solo se
  // muestra su detalle.
  const showStash = (sha: string) => {
    if (indexBySha.has(sha)) {
      selectCommit(sha, 'center')
      return
    }
    setOpen(null)
    setSelectedSha(sha)
  }

  // Pedidos de afuera: ver un commit o stash, el linaje de una rama o los cambios sin commitear.
  const handledRequest = useRef(0)
  useEffect(() => {
    if (!showRequest || showRequest.nonce === handledRequest.current) return
    handledRequest.current = showRequest.nonce
    if (showRequest.kind === 'branch') showBranch(showRequest.ref)
    else if (showRequest.kind === 'wip') {
      if (hasWip) selectCommit(WIP_SHA, 'center')
    } else if (indexBySha.has(showRequest.sha)) selectCommit(showRequest.sha, 'center')
    else showStash(showRequest.sha)
    // Solo cuando llega un pedido nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRequest])

  // Esc deja de resaltar la rama (si hay un archivo abierto, primero se cierra ese).
  useEffect(() => {
    if (!lineageRef || open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.key === 'Escape' && !target?.closest('input, textarea')) setLineageRef(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lineageRef, open])

  const togglePanel = useCallback((panel: PanelId) => {
    setLayout((l) => setPanelOpen(l, panel, !l.docks.find((d) => d.panel === panel)?.open))
  }, [])

  // Atajos de la pestaña visible: Ctrl+K muestra u oculta el panel de ramas (como en GitKraken),
  // Ctrl+J el de detalle y Ctrl+F lleva a la búsqueda.
  useEffect(() => {
    if (!active) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return
      const element = document.querySelector(`[data-history-root="${CSS.escape(repo.root)}"]`)
      if (!element || element.closest('[hidden]')) return
      const key = e.key.toLowerCase()
      if (key === 'k') togglePanel('refs')
      else if (key === 'j') togglePanel('details')
      else if (key === 'f') {
        searchRef.current?.focus()
        searchRef.current?.select()
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [repo.root, active, togglePanel])

  // ---------- Acomodar los paneles arrastrándolos ----------

  /** Dónde caería el panel arrastrado según la posición del mouse. */
  const dropTarget = (panel: DockDrag['panel'], x: number, y: number): DockDrag['target'] => {
    const grid = gridRef.current?.getBoundingClientRect()
    const center = centerRef.current?.getBoundingClientRect()
    if (!grid || !center) return null
    const inside = (r: DOMRect) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    if (!inside(grid)) return null
    // Sobre el gráfico: al lado del gráfico (el gráfico mismo, a ese borde de la ventana).
    if (panel !== 'center' && inside(center)) return { side: nearestSide(center, x, y), placement: 'inner' }
    return { side: nearestSide(grid, x, y), placement: 'outer' }
  }

  const startDrag = (panel: DockDrag['panel']) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    // El arrastre vive en una ref (para leerlo al soltar) y se copia al estado para dibujarlo.
    let current: DockDrag = { panel, startX, startY, moving: false, target: null }
    setDrag(current)
    const onMove = (ev: PointerEvent) => {
      const moving = current.moving || Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5
      current = { ...current, moving, target: moving ? dropTarget(panel, ev.clientX, ev.clientY) : null }
      setDrag(current)
    }
    const finish = (apply: boolean) => () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('dock-dragging')
      setDrag(null)
      const { target } = current
      if (!apply || !current.moving || !target) return
      setLayout((l) => (panel === 'center' ? moveCenter(l, target.side) : movePanel(l, panel, target.side, target.placement)))
    }
    const onUp = finish(true)
    const onKey = (ev: globalThis.KeyboardEvent) => ev.key === 'Escape' && finish(false)()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    document.body.classList.add('dock-dragging')
  }

  /** Menú de la barra de un panel: moverlo a un lado u ocultarlo (lo mismo que arrastrar, con el teclado). */
  const openPanelMenu = (panel: PanelId, at: MenuAnchor) => {
    const dock = layout.docks.find((d) => d.panel === panel)
    const sides: Side[] = ['left', 'right', 'top', 'bottom']
    menu.open(at, tidy([
      { kind: 'label', label: t('Panel de {value}', { value: PANEL_NAMES[panel].toLowerCase() }) },
      ...sides.map(
        (side): MenuItem => ({
          kind: 'check',
          label: t('Ponerlo {value}', { value: SIDE_NAMES[side] }),
          checked: dock?.side === side,
          onSelect: () => setLayout((l) => movePanel(l, panel, side, 'inner'))
        })
      ),
      { kind: 'separator' },
      ...(panel === 'details'
        ? ([
            { kind: 'separator' },
            { kind: 'label', label: t('Qué mostrar') },
            { kind: 'check', label: t('SHA, padres y ramas'), checked: detailsPrefs.facts, onSelect: () => setDetailsPrefs({ facts: !detailsPrefs.facts }) },
            { kind: 'check', label: t('Mensaje completo (sin "Ver más")'), checked: detailsPrefs.fullMessage, onSelect: () => setDetailsPrefs({ fullMessage: !detailsPrefs.fullMessage }) },
            { kind: 'check', label: t('Archivos en árbol de carpetas'), checked: detailsPrefs.files === 'tree', onSelect: () => setDetailsPrefs({ files: detailsPrefs.files === 'tree' ? 'list' : 'tree' }) }
          ] satisfies MenuItem[])
        : []),
      { kind: 'separator' },
      { label: t('Ocultarlo ({value})', { value: panel === 'refs' ? 'Ctrl+K' : 'Ctrl+J' }), icon: X, onSelect: () => togglePanel(panel) }
    ]))
  }

  /** Menú Disposición de la barra de herramientas. */
  const openLayoutMenu = (at: MenuAnchor) => {
    const current = matchingPreset(layout)
    const isOpen = (panel: PanelId) => layout.docks.find((d) => d.panel === panel)?.open ?? false
    menu.open(at, [
      { kind: 'label', label: t('Disposición') },
      ...PRESETS.map((p): MenuItem => ({ kind: 'check', label: p.label, checked: current === p.id, onSelect: () => setLayout(p.layout) })),
      { kind: 'separator' },
      { kind: 'check', label: t('Panel de ramas (Ctrl+K)'), checked: isOpen('refs'), onSelect: () => togglePanel('refs') },
      { kind: 'check', label: t('Panel de detalle (Ctrl+J)'), checked: isOpen('details'), onSelect: () => togglePanel('details') },
      { kind: 'separator' },
      { label: t('Elegir columnas…'), icon: Columns3, onSelect: () => openHeaderMenu(at) }
    ])
  }

  const lineage = useMemo((): LineageView | null => {
    if (!lineageRef || !insight || insight.ref !== lineageRef) return null
    const highlight = new Set<string>([insight.tip, ...insight.ownCommits])
    const markers = new Map<string, LineageMarker>()
    const base = insight.base?.name ?? t('la rama principal')
    if (insight.forkPoint && !insight.isBase) {
      highlight.add(insight.forkPoint)
      markers.set(insight.forkPoint, { kind: 'fork', text: t('{name} nace acá', { name: insight.name }) })
    }
    if (insight.merge?.kind === 'merge-commit') {
      highlight.add(insight.merge.sha)
      markers.set(insight.merge.sha, { kind: 'merge', text: t('fusionada en {base}', { base }) })
    }
    return { highlight, markers }
  }, [lineageRef, insight])

  // ---------- Menús de clic derecho ----------

  const openRowMenu = (sha: string, at: MenuAnchor) => {
    if (sha === WIP_SHA) {
      menu.open(at, menus.wip())
      return
    }
    const stash = stashBySha.get(sha)
    if (stash) {
      menu.open(at, menus.stash(stash))
      return
    }
    const commit = rows[indexBySha.get(sha) ?? -1]
    if (commit) menu.open(at, menus.commit(commit))
  }
  const openRefMenu = (key: string, at: MenuAnchor) => {
    const ref = refByName.get(key)
    if (ref) menu.open(at, menus.ref(ref))
  }
  const openDropMenu = (source: string, target: string, at: MenuAnchor) => {
    const from = refByName.get(source)
    const to = refByName.get(target)
    if (from && to) menu.open(at, menus.drop(from, to))
  }
  /** El ojo del panel: oculta o vuelve a mostrar la rama. Si se están mostrando solo algunas, la suma o la saca. */
  const toggleHidden = (ref: RefInfo) => {
    const toggle = (list: string[]) => (list.includes(ref.ref) ? list.filter((r) => r !== ref.ref) : [...list, ref.ref])
    if (filter.solo.length > 0) props.onFilterChange({ hidden: filter.hidden, solo: toggle(filter.solo) })
    else props.onFilterChange({ hidden: toggle(filter.hidden), solo: [] })
  }

  const openHeaderMenu = (at: MenuAnchor) => {
    const toggle = (id: ColumnId) =>
      setColumns((c) => ({ ...c, hidden: c.hidden.includes(id) ? c.hidden.filter((h) => h !== id) : [...c.hidden, id] }))
    const items: MenuItem[] = [
      { kind: 'label', label: t('Columnas') },
      ...(Object.keys(COLUMN_LABELS) as ColumnId[]).map(
        (id): MenuItem => ({ kind: 'check', label: COLUMN_LABELS[id], checked: !columns.hidden.includes(id), disabled: id === 'message', onSelect: () => toggle(id) })
      ),
      { kind: 'separator' },
      {
        label: t('Ajustar el gráfico a sus carriles'),
        icon: Columns3,
        disabled: columns.widths.graph === undefined,
        onSelect: () =>
          setColumns((c) => {
            const widths = { ...c.widths }
            delete widths.graph
            return { ...c, widths }
          })
      },
      { label: t('Restablecer columnas'), icon: RotateCcw, onSelect: () => setColumns(DEFAULT_COLUMNS) }
    ]
    menu.open(at, items)
  }

  const workingOpen = open?.kind === 'working' ? open : null
  const selectedStash = selectedSha ? stashBySha.get(selectedSha) : undefined
  const filtered = filter.hidden.length + filter.solo.length > 0
  const grid = layoutGrid(layout, appearance.glass ? '8px' : '1px')

  // Búsqueda, filtro y disposición: van a la barra de herramientas, así no hace falta otra barra.
  const search = (
    <div className="history-search">
      {filtered && (
        <span className="filter-chip" title={t('Hay ramas ocultas o se muestran solo algunas')}>
          <Eye size={13} strokeWidth={1.75} aria-hidden />
          {filter.solo.length > 0 ? tn(filter.solo.length, 'Solo {n} rama', 'Solo {n} ramas') : tn(filter.hidden.length, '{n} oculta', '{n} ocultas')}
          <button className="link" onClick={props.onShowAll}>
            {t('mostrar todas')}
          </button>
        </span>
      )}
      <label className="field field--search history-search__field" title={tn(commits.length, '{n} commit cargado', '{n} commits cargados')}>
        <Search size={14} strokeWidth={1.75} aria-hidden />
        <input
          ref={searchRef}
          type="search"
          placeholder={codeSearch ? t('Buscar en el código de los commits') : t('Buscar commits (Ctrl+F)')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          aria-label={t('Buscar por mensaje, autor o SHA')}
        />
        {matches ? (
          <>
            <span className="history-search__count" aria-live="polite">
              {matchList.length === 0 ? t('Sin resultados') : t('{pos} de {total}', { pos: matchPosition || '–', total: matchList.length })}
            </span>
            <button className="btn btn--icon btn--ghost btn--sm" aria-label={t('Coincidencia anterior')} title={t('Anterior (Shift+Enter)')} onClick={() => goToMatch(-1)}>
              <ArrowUp size={14} strokeWidth={1.75} />
            </button>
            <button className="btn btn--icon btn--ghost btn--sm" aria-label={t('Coincidencia siguiente')} title={t('Siguiente (Enter)')} onClick={() => goToMatch(1)}>
              <ArrowDown size={14} strokeWidth={1.75} />
            </button>
          </>
        ) : codeSearch && query.trim().length >= 2 ? (
          <span className="history-search__count">{t('Buscando…')}</span>
        ) : (
          loading && <span className="history-search__count">{t('Cargando…')}</span>
        )}
        <button
          className={`btn btn--icon btn--ghost btn--sm${codeSearch ? ' btn--pressed' : ''}`}
          aria-label={t('Buscar en el código de los commits')}
          aria-pressed={codeSearch}
          title={codeSearch ? t('Buscando en el código (los commits que agregan o quitan el texto). Clic para buscar en mensajes, autores y SHA.') : t('Buscar en el código de los commits (los que agregan o quitan el texto)')}
          onClick={() => setCodeSearch((c) => !c)}
        >
          <Code size={14} strokeWidth={1.75} />
        </button>
      </label>
      <button
        className="btn btn--icon btn--ghost"
        aria-label={t('Disposición de los paneles')}
        title={t('Disposición de los paneles')}
        onClick={(e) => openLayoutMenu(e.currentTarget.getBoundingClientRect())}
      >
        <LayoutDashboard size={16} strokeWidth={1.75} />
      </button>
    </div>
  )

  const panelBar = (panel: PanelId, title: string, extra?: ReactNode) => (
    <div className="panel-bar">
      <span className="dock-grip" title={t('Arrastrá para poner el panel en otro lugar')} onPointerDown={startDrag(panel)}>
        <GripVertical size={13} strokeWidth={1.75} aria-hidden />
        <span className="panel-bar__title">{title}</span>
      </span>
      {extra}
      <button
        className="btn btn--icon btn--ghost btn--sm"
        aria-label={t('Opciones del panel de {value}', { value: PANEL_NAMES[panel].toLowerCase() })}
        title={t('Moverlo u ocultarlo')}
        onClick={(e) => openPanelMenu(panel, e.currentTarget.getBoundingClientRect())}
      >
        <MoreHorizontal size={14} strokeWidth={1.75} />
      </button>
    </div>
  )

  const splitterFor = (panel: PanelId) => {
    const placed = grid.panels[panel]
    const dock = layout.docks.find((d) => d.panel === panel)
    if (!placed || !dock) return null
    return (
      <Splitter
        key={`splitter-${panel}`}
        side={placed.side}
        size={dock.size}
        min={SIZE_LIMITS.min}
        max={SIZE_LIMITS.max}
        label={t('Tamaño del panel de {value}', { value: PANEL_NAMES[panel].toLowerCase() })}
        style={placed.splitter}
        onChange={(size) => setLayout((l) => resizePanel(l, panel, size))}
        onReset={() => setLayout((l) => resizePanel(l, panel, defaultSize(panel, placed.side)))}
      />
    )
  }

  return (
    <div
      ref={gridRef}
      className={`history${drag?.moving ? ' history--dragging' : ''}`}
      data-history-root={repo.root}
      style={{ gridTemplateColumns: grid.columns, gridTemplateRows: grid.rows }}
    >
      {active && searchSlot && createPortal(search, searchSlot)}

      <aside
        className="panel glass history__side"
        style={grid.panels.refs?.panel}
        hidden={!grid.panels.refs}
        data-side={grid.panels.refs?.side}
        aria-label={t('Ramas, etiquetas y guardados')}
      >
        {panelBar('refs', t('Ramas'))}
        <RefsPanel
          refs={refs}
          stashes={stashes}
          filter={filter}
          selectedRef={lineageRef}
          selectedStash={selectedStash?.sha ?? null}
          onSelectRef={(ref) => selectBranch(ref.ref)}
          onShowLineage={(ref) => (ref.ref === lineageRef ? setLineageRef(null) : showBranch(ref.ref))}
          onSelectStash={(stash) => showStash(stash.sha)}
          onRefMenu={(ref, at) => menu.open(at, menus.ref(ref))}
          onStashMenu={(stash, at) => menu.open(at, menus.stash(stash))}
          onRefDoubleClick={(ref) => props.onCheckout(ref.ref)}
          onRefDrop={(source, target, at) => openDropMenu(source, target.ref, at)}
          onToggleHidden={toggleHidden}
        />
      </aside>
      {splitterFor('refs')}

      <section ref={centerRef} className="panel glass history__center" style={grid.center}>
        {/* Cada panel oculto deja una pestaña en su borde para volver a abrirlo con un clic. */}
        {layout.docks
          .filter((dock) => !dock.open)
          .map((dock) => {
            const Icon = RAIL_ICONS[dock.side]
            const name = PANEL_NAMES[dock.panel]
            return (
              <button
                key={dock.panel}
                className="dock-rail"
                data-side={dock.side}
                onClick={() => togglePanel(dock.panel)}
                title={t('Mostrar el panel de {value} ({keys})', { value: name.toLowerCase(), keys: dock.panel === 'refs' ? 'Ctrl+K' : 'Ctrl+J' })}
              >
                <Icon size={13} strokeWidth={1.75} aria-hidden />
                <span>{name}</span>
              </button>
            )
          })}
        {/* Con el panel de detalle oculto, el linaje se muestra arriba del gráfico. */}
        {lineageRef && open === null && !grid.panels.details && (
          <BranchInsightCard
            name={refByName.get(lineageRef)?.name ?? lineageRef}
            insight={insight?.ref === lineageRef ? insight : null}
            onGoTo={(sha) => selectCommit(sha, 'center')}
            onCompare={props.onCompare}
            onClose={() => setLineageRef(null)}
          />
        )}

        <div className="history__list" hidden={open !== null}>
          {page === null ? (
            <EmptyState title={t('Cargando historial…')} />
          ) : rows.length === 0 ? (
            filtered ? (
              <EmptyState title={t('No hay ramas a la vista')}>
                {t('Todas las ramas están ocultas.')}{' '}
                <button className="link" onClick={props.onShowAll}>
                  {t('Mostrar todas')}
                </button>
              </EmptyState>
            ) : (
              <EmptyState title={t('Este repositorio todavía no tiene commits')}>
                {t('Hacé el primer commit desde la terminal o el editor y va a aparecer acá.')}
              </EmptyState>
            )
          ) : (
            <CommitList
              commits={rows}
              graph={graph}
              labels={labels}
              head={refs.head}
              selectedSha={selectedSha}
              matches={matches}
              lineage={lineage}
              selectedRef={lineageRef}
              scrollRequest={scrollRequest}
              wip={wip}
              stashes={stashBySha}
              columns={columns}
              graphAvatars={appearance.graphAvatars}
              onColumnsChange={setColumns}
              onSelect={(sha, viaKeyboard) => selectCommit(sha, viaKeyboard ? 'nearest' : null)}
              onSelectRef={selectBranch}
              onNearEnd={loadMore}
              onRowMenu={openRowMenu}
              onRefMenu={openRefMenu}
              onHeaderMenu={openHeaderMenu}
              onRefDoubleClick={props.onCheckout}
              onRefDrop={openDropMenu}
              onDragPanel={startDrag('center')}
            />
          )}
        </div>

        {open?.kind === 'commit' && (
          <div className="history__diff">
            <div className="backbar">
              <button className="btn btn--sm" onClick={() => setOpen(null)}>
                <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
                {t('Volver al historial')}
              </button>
              <span className="text-2 small">
                {stashBySha.has(open.sha) ? t('Guardado') : t('Commit')} <code>{shortSha(open.sha)}</code> {t('· Esc para volver')}
              </span>
            </div>
            <DiffView
              root={repo.root}
              left={{ kind: 'ref', ref: open.parent }}
              right={{ kind: 'ref', ref: open.sha }}
              labelA={open.parent ? t('padre {sha}', { sha: shortSha(open.parent) }) : t('sin padre')}
              labelB={`${stashBySha.has(open.sha) ? t('guardado') : 'commit'} ${shortSha(open.sha)}`}
              change={open.change}
              options={options}
              onOptionsChange={onOptionsChange}
            />
          </div>
        )}

        {workingOpen && (
          <div className="history__diff">
            <WorkingFileView
              root={repo.root}
              file={workingOpen.file}
              area={workingOpen.area}
              reloadKey={statusVersion}
              options={options}
              onOptionsChange={onOptionsChange}
              onBack={() => setOpen(null)}
              onChanged={props.onRefreshStatus}
              onError={onError}
            />
          </div>
        )}
      </section>

      {splitterFor('details')}
      <aside
        className="panel glass history__details"
        style={grid.panels.details?.panel}
        hidden={!grid.panels.details}
        data-side={grid.panels.details?.side}
        aria-label={t('Detalle')}
      >
        {panelBar('details', selectedSha === WIP_SHA ? t('Cambios') : t('Detalle'))}
        {lineageRef && (
          <BranchInsightCard
            name={refByName.get(lineageRef)?.name ?? lineageRef}
            insight={insight?.ref === lineageRef ? insight : null}
            onGoTo={(sha) => selectCommit(sha, 'center')}
            onCompare={props.onCompare}
            onClose={() => setLineageRef(null)}
            compact
          />
        )}
        <div className="history__details-body">
          {selectedSha === WIP_SHA && status ? (
            <WorkingTreePanel
              root={repo.root}
              status={status}
              openFile={workingOpen ? { path: workingOpen.file.path, area: workingOpen.area } : null}
              draft={draft}
              onDraftChange={setDraft}
              onOpenFile={(file, area) => setOpen({ kind: 'working', file, area })}
              onChanged={props.onRefreshStatus}
              onCommitted={onCommitted}
              onError={onError}
            />
          ) : selectedSha && selectedSha !== WIP_SHA ? (
            <>
              {selectedStash && (
                <div className="details__stash">
                  <code>{`stash@{${selectedStash.index}}`}</code> {stashLabel(selectedStash.message)}
                </div>
              )}
              <CommitDetails
                root={repo.root}
                sha={selectedSha}
                refsVersion={reloadKey}
                selectedPath={open?.kind === 'commit' ? open.change.path : null}
                onOpenFile={openFileFromDetails}
                onSelectCommit={(sha) => selectCommit(sha, 'center')}
                onSelectBranch={selectBranchByName}
              />
            </>
          ) : (
            <div className="details details--empty text-2">{t('Elegí un commit para ver su detalle.')}</div>
          )}
        </div>
      </aside>

      {drag?.moving && <DockPreview gridRef={gridRef} centerRef={centerRef} drag={drag} layout={layout} />}
    </div>
  )
}

/** Mientras se arrastra un panel: dónde va a quedar si se suelta ahí. */
function DockPreview({
  gridRef,
  centerRef,
  drag,
  layout
}: {
  gridRef: React.RefObject<HTMLDivElement | null>
  centerRef: React.RefObject<HTMLElement | null>
  drag: DockDrag
  layout: DockLayout
}) {
  const grid = gridRef.current?.getBoundingClientRect()
  const center = centerRef.current?.getBoundingClientRect()
  if (!grid || !center) return null
  const target = drag.target
  const name = drag.panel === 'center' ? t('el gráfico') : t('el panel de {value}', { value: PANEL_NAMES[drag.panel].toLowerCase() })
  let box: { left: number; top: number; width: number; height: number } | null = null
  if (target) {
    const area = target.placement === 'inner' ? center : grid
    const size =
      drag.panel === 'center'
        ? (target.side === 'left' || target.side === 'right' ? area.width : area.height) * 0.6
        : Math.min(
            (target.side === 'left' || target.side === 'right' ? area.width : area.height) * 0.45,
            layout.docks.find((d) => d.panel === drag.panel)?.size ?? 260
          )
    box = {
      left: (target.side === 'right' ? area.right - size : area.left) - grid.left,
      top: (target.side === 'bottom' ? area.bottom - size : area.top) - grid.top,
      width: target.side === 'left' || target.side === 'right' ? size : area.width,
      height: target.side === 'top' || target.side === 'bottom' ? size : area.height
    }
  }
  const where = target ? (target.placement === 'inner' ? t('{value} del gráfico', { value: SIDE_NAMES[target.side] }) : t('{value} de todo', { value: SIDE_NAMES[target.side] })) : null
  return (
    <div className="dock-overlay" aria-live="polite">
      {box && <div className="dock-overlay__preview" style={box} />}
      <div className="dock-overlay__label">{where ? t('Soltá para poner {name} {where}', { name, where }) : t('Arrastrá {name} hacia un borde · Esc cancela', { name })}</div>
    </div>
  )
}
