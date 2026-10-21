import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { CommitDetails as Details, CommitInfo, CommitPage, FileChange, RefList, RepoInfo } from '../../../shared/types'
import { api } from '../api'
import { CommitDetails } from '../components/CommitDetails'
import { CommitList, type ScrollRequest } from '../components/CommitList'
import { DiffView, type DiffOptions } from '../components/DiffView'
import { EmptyState } from '../components/EmptyState'
import { RefsPanel } from '../components/RefsPanel'
import { shortSha } from '../lib/format'
import { computeGraph } from '../lib/graph'
import { labelsByCommit } from '../lib/refs'

/** Commits que se cargan por tanda al bajar por el historial. */
const PAGE_SIZE = 1000
/** Mismo límite que acepta el proceso principal (MAX_COMMITS en git/repo.ts). */
const MAX_COMMITS = 50_000
const NO_COMMITS: CommitInfo[] = []

interface OpenFile {
  change: FileChange
  sha: string
  /** Primer padre del commit; vacío si es el primer commit del repo. */
  parent: string
}

interface Props {
  repo: RepoInfo
  refs: RefList
  /** Cambia cuando hay que volver a leer el historial (por ejemplo, después de un fetch). */
  reloadKey: number
  options: DiffOptions
  onOptionsChange(options: DiffOptions): void
  onError(message: string): void
}

export function HistoryView({ repo, refs, reloadKey, options, onOptionsChange, onError }: Props) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [page, setPage] = useState<CommitPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedSha, setSelectedSha] = useState<string | null>(null)
  // Commit que se pidió ver pero todavía no está cargado: se sigue cargando historial hasta encontrarlo.
  const [pendingSha, setPendingSha] = useState<string | null>(null)
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null)
  const [openFile, setOpenFile] = useState<OpenFile | null>(null)
  const [query, setQuery] = useState('')
  const nonce = useRef(0)

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

  const commits = page?.commits ?? NO_COMMITS
  const graph = useMemo(() => computeGraph(commits), [commits])
  const labels = useMemo(() => labelsByCommit(refs.refs, refs.current, refs.head), [refs])
  const indexBySha = useMemo(() => new Map(commits.map((c, i) => [c.sha, i])), [commits])

  const requestScroll = (sha: string, align: ScrollRequest['align']) =>
    setScrollRequest({ sha, align, nonce: ++nonce.current })

  const selectCommit = (sha: string, align: ScrollRequest['align'] | null) => {
    setOpenFile(null)
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

  const loadMore = useCallback(() => {
    // Solo si lo cargado ya llegó al límite actual: si no, ya hay una tanda en camino.
    const caughtUp = page !== null && page.commits.length >= limit
    if (caughtUp && page.hasMore && !loading && limit < MAX_COMMITS) setLimit((l) => Math.min(MAX_COMMITS, l + PAGE_SIZE))
  }, [page, loading, limit])

  // Esc vuelve del diff al historial.
  useEffect(() => {
    if (!openFile) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpenFile(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openFile])

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
    setOpenFile({ change, sha: details.sha, parent: details.parents[0] ?? '' })

  return (
    <div className="history">
      <RefsPanel refs={refs} onSelectRef={(ref) => selectCommit(ref.target, 'center')} />

      <section className="history__center">
        <div className="history__toolbar" hidden={openFile !== null}>
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

        <div className="history__list" hidden={openFile !== null}>
          {page === null ? (
            <EmptyState title="Cargando historial…" />
          ) : commits.length === 0 ? (
            <EmptyState title="Este repositorio todavía no tiene commits" />
          ) : (
            <CommitList
              commits={commits}
              graph={graph}
              labels={labels}
              head={refs.head}
              selectedSha={selectedSha}
              matches={matches}
              scrollRequest={scrollRequest}
              onSelect={(sha, viaKeyboard) => selectCommit(sha, viaKeyboard ? 'nearest' : null)}
              onNearEnd={loadMore}
            />
          )}
        </div>

        {openFile && (
          <div className="history__diff">
            <div className="history__back">
              <button className="button button--small" onClick={() => setOpenFile(null)}>
                ← Volver al historial
              </button>
              <span className="muted small">Commit {shortSha(openFile.sha)} · Esc para volver</span>
            </div>
            <DiffView
              root={repo.root}
              refA={openFile.parent}
              refB={openFile.sha}
              labelA={openFile.parent ? `padre ${shortSha(openFile.parent)}` : 'sin padre'}
              labelB={`commit ${shortSha(openFile.sha)}`}
              change={openFile.change}
              options={options}
              onOptionsChange={onOptionsChange}
            />
          </div>
        )}
      </section>

      <aside className="history__details" aria-label="Detalle del commit">
        {selectedSha ? (
          <CommitDetails
            root={repo.root}
            sha={selectedSha}
            selectedPath={openFile?.change.path ?? null}
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
