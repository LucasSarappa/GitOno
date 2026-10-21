import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type {
  CommitDetails as Details,
  CommitInfo,
  CommitPage,
  FileChange,
  RefList,
  RepoInfo,
  WorkingArea,
  WorkingFile,
  WorkingTreeStatus
} from '../../../shared/types'
import { api } from '../api'
import { CommitDetails } from '../components/CommitDetails'
import { CommitList, WIP_SHA, type ScrollRequest, type WipSummary } from '../components/CommitList'
import { DiffView, type DiffOptions } from '../components/DiffView'
import { EmptyState } from '../components/EmptyState'
import { RefsPanel } from '../components/RefsPanel'
import { WorkingFileView } from '../components/WorkingFileView'
import { EMPTY_DRAFT, WorkingTreePanel, type CommitDraft } from '../components/WorkingTreePanel'
import { shortSha } from '../lib/format'
import { computeGraph } from '../lib/graph'
import { labelsByCommit } from '../lib/refs'

/** Commits que se cargan por tanda al bajar por el historial. */
const PAGE_SIZE = 1000
/** Mismo límite que acepta el proceso principal (MAX_COMMITS en git/repo.ts). */
const MAX_COMMITS = 50_000
const NO_COMMITS: CommitInfo[] = []

/** Lo que se muestra en el centro en lugar del gráfico. */
type Open =
  | { kind: 'commit'; change: FileChange; sha: string; parent: string }
  | { kind: 'working'; file: WorkingFile; area: WorkingArea }

interface Props {
  repo: RepoInfo
  refs: RefList
  /** Cambia cuando hay que volver a leer el historial (por ejemplo, después de un fetch). */
  reloadKey: number
  /** Cambia cuando algo cambió en la carpeta de trabajo y hay que releer el estado. */
  statusKey: number
  options: DiffOptions
  onOptionsChange(options: DiffOptions): void
  onError(message: string): void
  /** Se llama después de un commit: hay que releer ramas e historial. */
  onRepoMutated(): void
}

export function HistoryView({ repo, refs, reloadKey, statusKey, options, onOptionsChange, onError, onRepoMutated }: Props) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [page, setPage] = useState<CommitPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedSha, setSelectedSha] = useState<string | null>(null)
  // Commit que se pidió ver pero todavía no está cargado: se sigue cargando historial hasta encontrarlo.
  const [pendingSha, setPendingSha] = useState<string | null>(null)
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<WorkingTreeStatus | null>(null)
  // Sube cada vez que llega un estado nuevo: los diffs de archivos locales se releen con él.
  const [statusVersion, setStatusVersion] = useState(0)
  const [statusNonce, setStatusNonce] = useState(0)
  const [draft, setDraft] = useState<CommitDraft>(EMPTY_DRAFT)
  const nonce = useRef(0)
  // Commit recién creado: se centra en la lista apenas aparezca.
  const scrollWhenLoaded = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.listCommits(repo.root, limit).then(
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
  }, [repo.root, limit, reloadKey, onError])

  useEffect(() => {
    let cancelled = false
    api.workingStatus(repo.root).then(
      (result) => {
        if (cancelled) return
        setStatus(result)
        setStatusVersion((v) => v + 1)
      },
      (error: Error) => !cancelled && onError(error.message)
    )
    return () => {
      cancelled = true
    }
  }, [repo.root, statusKey, statusNonce, onError])

  const refreshStatus = useCallback(() => setStatusNonce((n) => n + 1), [])

  const wip: WipSummary | null =
    status && status.staged.length + status.unstaged.length + status.conflicted.length > 0
      ? { staged: status.staged.length, unstaged: status.unstaged.length, conflicted: status.conflicted.length }
      : null
  const hasWip = wip !== null
  const wipParent = status?.head ?? null

  const commits = page?.commits ?? NO_COMMITS
  // La fila de cambios sin commitear va arriba de todo, unida al commit actual.
  const rows = useMemo((): CommitInfo[] => {
    if (!hasWip) return commits
    const wipRow = { sha: WIP_SHA, parents: wipParent ? [wipParent] : [], authorName: '', authorEmail: '', authorDate: 0, subject: '' }
    return [wipRow, ...commits]
  }, [commits, hasWip, wipParent])
  const graph = useMemo(() => computeGraph(rows.map((c) => (c.sha === WIP_SHA ? { ...c, virtual: true } : c))), [rows])
  const labels = useMemo(() => labelsByCommit(refs.refs, refs.current, refs.head), [refs])
  const indexBySha = useMemo(() => new Map(rows.map((c, i) => [c.sha, i])), [rows])

  const requestScroll = (sha: string, align: ScrollRequest['align']) =>
    setScrollRequest({ sha, align, nonce: ++nonce.current })

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
      onError('Ese commit no aparece en el historial de ramas y tags cargado.')
    }
  }, [pendingSha, page, loading, indexBySha, limit, onError])

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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const found = commits.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.authorName.toLowerCase().includes(q) ||
        c.authorEmail.toLowerCase().includes(q) ||
        c.sha.startsWith(q)
    )
    return new Set(found.map((c) => c.sha))
  }, [commits, query])
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
    setOpen(null)
    setSelectedSha(sha)
    scrollWhenLoaded.current = sha
    refreshStatus()
    onRepoMutated()
  }

  const workingOpen = open?.kind === 'working' ? open : null

  return (
    <div className="history">
      <RefsPanel refs={refs} onSelectRef={(ref) => selectCommit(ref.target, 'center')} />

      <section className="history__center">
        <div className="history__toolbar" hidden={open !== null}>
          <input
            className="filter history__search"
            type="search"
            placeholder="Buscar por mensaje, autor o SHA…  (Enter: siguiente)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          {matches && (
            <>
              <span className="muted small history__matches">
                {matchList.length === 0 ? 'Sin resultados' : `${matchPosition || '–'} de ${matchList.length}`}
              </span>
              <button className="icon-button" title="Anterior (Shift+Enter)" onClick={() => goToMatch(-1)}>
                ↑
              </button>
              <button className="icon-button" title="Siguiente (Enter)" onClick={() => goToMatch(1)}>
                ↓
              </button>
            </>
          )}
          <span className="muted small history__count">
            {loading ? 'Cargando…' : `${commits.length.toLocaleString('es-AR')} commits`}
            {page?.hasMore && !loading && (
              <>
                {' · '}
                <button className="link-button" onClick={loadMore}>
                  cargar más
                </button>
              </>
            )}
          </span>
        </div>

        <div className="history__list" hidden={open !== null}>
          {page === null ? (
            <EmptyState title="Cargando historial…" />
          ) : rows.length === 0 ? (
            <EmptyState title="Este repositorio todavía no tiene commits" />
          ) : (
            <CommitList
              commits={rows}
              graph={graph}
              labels={labels}
              head={refs.head}
              selectedSha={selectedSha}
              matches={matches}
              scrollRequest={scrollRequest}
              wip={wip}
              onSelect={(sha, viaKeyboard) => selectCommit(sha, viaKeyboard ? 'nearest' : null)}
              onNearEnd={loadMore}
            />
          )}
        </div>

        {open?.kind === 'commit' && (
          <div className="history__diff">
            <div className="history__back">
              <button className="button button--small" onClick={() => setOpen(null)}>
                ← Volver al historial
              </button>
              <span className="muted small">Commit {shortSha(open.sha)} · Esc para volver</span>
            </div>
            <DiffView
              root={repo.root}
              left={{ kind: 'ref', ref: open.parent }}
              right={{ kind: 'ref', ref: open.sha }}
              labelA={open.parent ? `padre ${shortSha(open.parent)}` : 'sin padre'}
              labelB={`commit ${shortSha(open.sha)}`}
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
              onChanged={refreshStatus}
              onError={onError}
            />
          </div>
        )}
      </section>

      <aside className="history__details" aria-label="Detalle">
        {selectedSha === WIP_SHA && status ? (
          <WorkingTreePanel
            root={repo.root}
            status={status}
            openFile={workingOpen ? { path: workingOpen.file.path, area: workingOpen.area } : null}
            draft={draft}
            onDraftChange={setDraft}
            onOpenFile={(file, area) => setOpen({ kind: 'working', file, area })}
            onChanged={refreshStatus}
            onCommitted={onCommitted}
            onError={onError}
          />
        ) : selectedSha && selectedSha !== WIP_SHA ? (
          <CommitDetails
            root={repo.root}
            sha={selectedSha}
            selectedPath={open?.kind === 'commit' ? open.change.path : null}
            onOpenFile={openFileFromDetails}
            onSelectCommit={(sha) => selectCommit(sha, 'center')}
          />
        ) : (
          <div className="details details--empty muted">Elegí un commit para ver su detalle.</div>
        )}
      </aside>
    </div>
  )
}
