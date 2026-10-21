import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { CompareResult, FileChange, RefList, RepoInfo } from '../../../shared/types'
import { api } from '../api'
import { DiffView, type DiffOptions } from '../components/DiffView'
import { EmptyState } from '../components/EmptyState'
import { FileTree } from '../components/FileTree'
import { RefSelect } from '../components/RefSelect'
import { loadSetting, saveSetting } from '../lib/settings'
import { buildTree, visibleFiles } from '../lib/tree'

type Comparison = { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: CompareResult }

const NO_FILES: FileChange[] = []
const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 640

interface Props {
  repo: RepoInfo
  refs: RefList
  /** Cambia cuando hay que volver a comparar aunque A y B sigan iguales (ej. después de un fetch). */
  reloadKey: number
  options: DiffOptions
  onOptionsChange(options: DiffOptions): void
  onError(message: string): void
}

/** Compara el contenido de dos ramas (o tags) como si fueran dos carpetas. */
export function CompareView({ repo, refs, reloadKey, options, onOptionsChange, onError }: Props) {
  const [refA, setRefA] = useState(() => refs.refs.find((r) => r.ref === refs.current)?.ref ?? refs.refs[0]?.ref ?? '')
  const [refB, setRefB] = useState('')
  const [comparison, setComparison] = useState<Comparison>({ status: 'idle' })
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [sidebarWidth, setSidebarWidth] = useState(() => loadSetting('sidebarWidth', 320))

  useEffect(() => saveSetting('sidebarWidth', sidebarWidth), [sidebarWidth])

  // Si después de un fetch alguna rama elegida ya no existe, se deselecciona.
  useEffect(() => {
    const exists = (ref: string) => refs.refs.some((r) => r.ref === ref)
    if (refA && !exists(refA)) setRefA('')
    if (refB && !exists(refB)) setRefB('')
  }, [refs, refA, refB])

  useEffect(() => {
    if (!refA || !refB || refA === refB) {
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
        onError(e.message)
      }
    )
    return () => {
      cancelled = true
    }
  }, [repo.root, refA, refB, reloadKey, onError])

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
        left={{ kind: 'ref', ref: refA }}
        right={{ kind: 'ref', ref: refB }}
        labelA={labelFor(refA)}
        labelB={labelFor(refB)}
        change={selected}
        options={options}
        onOptionsChange={onOptionsChange}
      />
    )
  } else if (comparison.status === 'done') {
    main = <EmptyState title="Ningún archivo coincide con el filtro" />
  }

  return (
    <div className="compare">
      <div className="compare__toolbar">
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

function ResizeHandle({ onResize }: { onResize(x: number): void }) {
  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        // La posición es relativa al panel: el ancho es la distancia desde su borde izquierdo.
        const left = e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0
        onResize(e.clientX - left)
      }}
    />
  )
}
