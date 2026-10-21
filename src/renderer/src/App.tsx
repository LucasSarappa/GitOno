import { useCallback, useEffect, useState } from 'react'
import type { ProviderInfo, RefList, RepoInfo } from '../../shared/types'
import { api } from './api'
import type { DiffOptions } from './components/DiffView'
import { Welcome } from './components/Welcome'
import { loadSetting, saveSetting } from './lib/settings'
import { CompareView } from './views/CompareView'
import { HistoryView } from './views/HistoryView'

type View = 'history' | 'compare'

const VIEWS: { id: View; label: string }[] = [
  { id: 'history', label: 'Historial' },
  { id: 'compare', label: 'Comparar ramas' }
]

const DEFAULT_OPTIONS: DiffOptions = { sideBySide: true, ignoreWhitespace: false, hideUnchanged: true }

export function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [refs, setRefs] = useState<RefList | null>(null)
  const [view, setView] = useState<View>(() =>
    loadSetting<string>('view', 'history') === 'compare' ? 'compare' : 'history'
  )
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  // Las vistas vuelven a leer Git cuando cambia (por ejemplo, después de un fetch).
  const [reloadKey, setReloadKey] = useState(0)
  const [options, setOptions] = useState<DiffOptions>(() => loadSetting('diffOptions', DEFAULT_OPTIONS))

  useEffect(() => saveSetting('diffOptions', options), [options])
  useEffect(() => saveSetting('view', view), [view])

  const showError = useCallback((message: string) => setError(message), [])

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
  }, [])

  // Si la app se abrió con una carpeta como argumento, se abre ese repo directamente.
  useEffect(() => {
    void run(async () => {
      const path = await api.initialRepoPath()
      if (path) await showRepo(await api.openRepo(path))
    })
  }, [run, showRepo])

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
        setRefs(await api.listRefs(repo.root))
        setReloadKey((k) => k + 1)
      } finally {
        setFetching(false)
      }
    })

  if (!repo || !refs) return <Welcome onOpen={pickRepo} error={error} />

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar__repo">
          <span className="brand">GitOno</span>
          <button className="repo-button" onClick={pickRepo} title={`${repo.root}\nClic para abrir otro repositorio`}>
            <span className="repo-button__name">{repo.name}</span>
            <ProviderBadge repo={repo} />
          </button>
        </div>
        <nav className="tabs" role="tablist" aria-label="Vistas">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              className={`tab${view === v.id ? ' tab--active' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>
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

      {/* Las dos vistas quedan montadas para no perder lo que estabas mirando al cambiar de pestaña. */}
      <div className="view" hidden={view !== 'history'}>
        <HistoryView
          key={repo.root}
          repo={repo}
          refs={refs}
          reloadKey={reloadKey}
          options={options}
          onOptionsChange={setOptions}
          onError={showError}
        />
      </div>
      <div className="view" hidden={view !== 'compare'}>
        <CompareView
          key={repo.root}
          repo={repo}
          refs={refs}
          reloadKey={reloadKey}
          options={options}
          onOptionsChange={setOptions}
          onError={showError}
        />
      </div>
    </div>
  )
}

function ProviderBadge({ repo }: { repo: RepoInfo }) {
  const provider: ProviderInfo | null = repo.provider
  if (!provider) {
    // Un remoto que es una carpeta (otro clon en el disco) no tiene plataforma.
    return repo.remoteUrl ? (
      <span className="provider-badge" title={repo.remoteUrl}>
        Remoto local
      </span>
    ) : (
      <span className="provider-badge">Sin remoto</span>
    )
  }
  return (
    <span className={`provider-badge provider-badge--${provider.id}`} title={`${provider.host}/${provider.repoPath}`}>
      {provider.name}
    </span>
  )
}
