import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { CompareResult, FileChange, ProviderInfo, RefList, RepoInfo } from '../../shared/types'
import { api } from './api'
import { DiffView, type DiffOptions } from './components/DiffView'
import { FileTree } from './components/FileTree'
import { RefSelect } from './components/RefSelect'
import { Welcome } from './components/Welcome'
import { loadSetting, saveSetting } from './lib/settings'
import { buildTree, visibleFiles } from './lib/tree'

type Comparison = { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: CompareResult }

const DEFAULT_OPTIONS: DiffOptions = { sideBySide: true, ignoreWhitespace: false, hideUnchanged: true }
const NO_FILES: FileChange[] = []
const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 640

export function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [refs, setRefs] = useState<RefList | null>(null)
  const [refA, setRefA] = useState('')
  const [refB, setRefB] = useState('')
  const [comparison, setComparison] = useState<Comparison>({ status: 'idle' })
  // Se vuelve a comparar cuando cambia, aunque A y B sigan iguales (ej. después de un fetch).
  const [compareKey, setCompareKey] = useState(0)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [options, setOptions] = useState<DiffOptions>(() => loadSetting('diffOptions', DEFAULT_OPTIONS))
  const [sidebarWidth, setSidebarWidth] = useState(() => loadSetting('sidebarWidth', 320))

  useEffect(() => saveSetting('diffOptions', options), [options])
  useEffect(() => saveSetting('sidebarWidth', sidebarWidth), [sidebarWidth])

  const run = useCallback(async (task: () => Promise<void>) => {
    try {
      setError(null)
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const showRepo = useCallback(async (info: RepoInfo) => {
    const list = await api.listRefs(info.root)
    setRepo(info)
    setRefs(list)
    const current = list.refs.find((r) => r.ref === list.current)
    setRefA(current?.ref ?? list.refs[0]?.ref ?? '')
    setRefB('')
    setSelectedPath(null)
    setFilter('')
    setCollapsed(new Set())
  }, [])

  // Si la app se abrió con una carpeta como argumento, se abre ese repo directamente.
  useEffect(() => {
    void run(async () => {
      const path = await api.initialRepoPath()
      if (path) await showRepo(await api.openRepo(path))
    })
  }, [run, showRepo])

  useEffect(() => {
    if (!repo || !refA || !refB || refA === refB) {
      setComparison({ status: 'idle' })
      return
    }
    let cancelled = false
    setComparison({ status: 'loading' })
    api.compare(repo.root, refA, refB).then(
      (result) => !cancelled && setComparison({ status: 'done', result }),
      (e: Error) => {
        if (cancelled) return
        setComparison({ status: 'idle' })
        setError(e.message)
      }
    )
    return () => {
      cancelled = true
    }
  }, [repo, refA, refB, compareKey])

  const files = comparison.status === 'done' ? comparison.result.files : NO_FILES
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return files
    return files.filter((f) => f.path.toLowerCase().includes(query) || f.oldPath?.toLowerCase().includes(query))
  }, [files, filter])
  const tree = useMemo(() => buildTree(filtered), [filtered])
  const visible = useMemo(() => visibleFiles(tree, collapsed), [tree, collapsed])
  // Si el archivo elegido ya no está (otra comparación, filtro), se muestra el primero de la lista.
  const selected = filtered.find((f) => f.path === selectedPath) ?? visible[0] ?? null

  const pickRepo = () =>
    run(async () => {
      const info = await api.pickRepo()
      if (info) await showRepo(info)
    })

  const fetchAll = () =>
    repo &&
    run(async () => {
      setFetching(true)
      try {
        await api.fetchAll(repo.root)
        const list = await api.listRefs(repo.root)
        const exists = (ref: string) => list.refs.some((r) => r.ref === ref)
        setRefs(list)
        if (!exists(refA)) setRefA('')
        if (!exists(refB)) setRefB('')
        setCompareKey((k) => k + 1)
      } finally {
        setFetching(false)
      }
    })

  const toggleFolder = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const onTreeKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    if (visible.length === 0) return
    const index = selected ? visible.findIndex((f) => f.path === selected.path) : -1
    const step = e.key === 'ArrowDown' ? 1 : -1
    const next = visible[Math.min(visible.length - 1, Math.max(0, index + step))]
    setSelectedPath(next.path)
    document.querySelector(`[data-path="${CSS.escape(next.path)}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  if (!repo || !refs) return <Welcome onOpen={pickRepo} error={error} />

  const labelFor = (ref: string) => refs.refs.find((r) => r.ref === ref)?.name ?? ref

  let main: ReactNode
  if (!refB) {
    main = (
      <EmptyState title="Elegí la rama B">
        GitOno compara el contenido de A contra B como si fueran dos carpetas, sin cambiarte de rama ni tocar tus archivos.
      </EmptyState>
    )
  } else if (refA === refB) {
    main = <EmptyState title="Elegiste la misma rama en A y en B">Cambiá una de las dos para ver las diferencias.</EmptyState>
  } else if (comparison.status === 'loading') {
    main = <EmptyState title="Comparando…" />
  } else if (comparison.status === 'done' && files.length === 0) {
    main = (
      <EmptyState title="No hay diferencias de contenido">
        Los archivos de {labelFor(refA)} y {labelFor(refB)} son idénticos.
      </EmptyState>
    )
  } else if (selected) {
    main = (
      <DiffView
        root={repo.root}
        refA={refA}
        refB={refB}
        labelA={labelFor(refA)}
        labelB={labelFor(refB)}
        change={selected}
        options={options}
        onOptionsChange={setOptions}
      />
    )
  } else if (comparison.status === 'done') {
    main = <EmptyState title="Ningún archivo coincide con el filtro" />
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar__repo">
          <span className="brand">GitOno</span>
          <button className="repo-button" onClick={pickRepo} title={`${repo.root}\nClic para abrir otro repositorio`}>
            <span className="repo-button__name">{repo.name}</span>
            <ProviderBadge provider={repo.provider} />
          </button>
        </div>
        <div className="toolbar__refs">
          <RefSelect label="A" refs={refs} value={refA} onChange={setRefA} />
          <button
            className="icon-button"
            title="Intercambiar A y B"
            disabled={!refA || !refB}
            onClick={() => {
              setRefA(refB)
              setRefB(refA)
            }}
          >
            ⇄
          </button>
          <RefSelect label="B" refs={refs} value={refB} onChange={setRefB} />
        </div>
        <div className="toolbar__end">
          <button className="button" onClick={fetchAll} disabled={fetching} title="Trae las ramas nuevas del servidor (git fetch)">
            {fetching ? 'Actualizando…' : 'Actualizar ramas'}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button className="icon-button" title="Cerrar" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      <div className="workspace" style={{ gridTemplateColumns: `${sidebarWidth}px 5px minmax(0, 1fr)` }}>
        <aside className="sidebar">
          {comparison.status === 'done' && <Summary result={comparison.result} />}
          <input
            className="filter"
            type="search"
            placeholder="Filtrar archivos…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            disabled={files.length === 0}
          />
          <div className="sidebar__tree" onKeyDown={onTreeKeyDown}>
            <FileTree
              nodes={tree}
              selectedPath={selected?.path ?? null}
              collapsed={collapsed}
              onSelect={(change) => setSelectedPath(change.path)}
              onToggleFolder={toggleFolder}
            />
          </div>
        </aside>
        <ResizeHandle onResize={(x) => setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, x)))} />
        <main className="main">{main}</main>
      </div>
    </div>
  )
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

function Summary({ result }: { result: CompareResult }) {
  let additions = 0
  let deletions = 0
  for (const f of result.files) {
    additions += f.additions ?? 0
    deletions += f.deletions ?? 0
  }
  return (
    <div className="summary">
      <div>
        <strong>{plural(result.files.length, 'archivo', 'archivos')}</strong>{' '}
        <span className="added">+{additions}</span> <span className="deleted">−{deletions}</span>
      </div>
      <div className="muted small">
        B tiene {plural(result.commitsOnlyInB, 'commit', 'commits')} que A no tiene · A tiene{' '}
        {plural(result.commitsOnlyInA, 'commit', 'commits')} que B no tiene
      </div>
    </div>
  )
}

function ProviderBadge({ provider }: { provider: ProviderInfo | null }) {
  if (!provider) return <span className="provider-badge">Sin remoto</span>
  return (
    <span className={`provider-badge provider-badge--${provider.id}`} title={`${provider.host}/${provider.repoPath}`}>
      {provider.name}
    </span>
  )
}

function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
    </div>
  )
}

function ResizeHandle({ onResize }: { onResize(x: number): void }) {
  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) onResize(e.clientX)
      }}
    />
  )
}
