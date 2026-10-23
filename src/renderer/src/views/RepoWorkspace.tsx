import { GitBranch, GitCompareArrows, History, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ProviderInfo, RefList, RepoInfo } from '../../../shared/types'
import { api } from '../api'
import { AppearanceMenu } from '../components/AppearanceMenu'
import type { DiffOptions } from '../components/DiffView'
import { AvatarProvider } from '../lib/avatars'
import { loadSetting, saveSetting } from '../lib/settings'
import { CompareView, type CompareRequest } from './CompareView'
import { HistoryView } from './HistoryView'

type View = 'history' | 'compare'

const DEFAULT_OPTIONS: DiffOptions = { sideBySide: true, ignoreWhitespace: false, hideUnchanged: true }

interface Props {
  repo: RepoInfo
  /** Es la pestaña visible: solo esa se refresca al volver a la ventana. */
  active: boolean
}

/** Todo lo de un repo abierto en una pestaña: barra de herramientas, historial y comparación. */
export function RepoWorkspace({ repo, active }: Props) {
  const [refs, setRefs] = useState<RefList | null>(null)
  const [view, setView] = useState<View>('history')
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  // reloadKey relee ramas e historial (fetch, commit, ramas cambiadas); statusKey, la carpeta de trabajo.
  const [reloadKey, setReloadKey] = useState(0)
  const [statusKey, setStatusKey] = useState(0)
  const [options, setOptions] = useState<DiffOptions>(() => loadSetting('diffOptions', DEFAULT_OPTIONS))
  const [compareRequest, setCompareRequest] = useState<CompareRequest | null>(null)

  useEffect(() => saveSetting('diffOptions', options), [options])

  const showError = useCallback((message: string) => setError(message), [])

  const reloadRepo = useCallback(() => {
    api.listRefs(repo.root).then(setRefs, (e: Error) => setError(e.message))
    setReloadKey((k) => k + 1)
    setStatusKey((k) => k + 1)
  }, [repo.root])

  useEffect(() => {
    api.listRefs(repo.root).then(setRefs, (e: Error) => setError(e.message))
  }, [repo.root])

  // Se refresca sola cuando cambia algo en el repo (desde GitOno, la terminal o el editor).
  useEffect(() => {
    api.watchRepo(repo.root).catch((e: Error) => setError(e.message))
    const stop = api.onRepoChanged((root, change) => {
      if (root !== repo.root) return
      if (change === 'refs') reloadRepo()
      else setStatusKey((k) => k + 1)
    })
    return () => {
      stop()
      void api.unwatchRepo(repo.root)
    }
  }, [repo.root, reloadRepo])

  // Al volver a la ventana, por si algo cambió mientras no se miraba.
  useEffect(() => {
    if (!active) return
    const onFocus = () => setStatusKey((k) => k + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [active])

  const fetchAll = async () => {
    setFetching(true)
    setError(null)
    try {
      await api.fetchAll(repo.root)
      reloadRepo()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setFetching(false)
    }
  }

  const compare = (refA: string, refB: string) => {
    setCompareRequest({ refA, refB, nonce: Date.now() })
    setView('compare')
  }

  const currentBranch = refs?.current ? refs.current.replace(/^refs\/heads\//, '') : null

  return (
    <AvatarProvider root={repo.root} provider={repo.provider}>
      <div className="workspace">
        <header className="toolbar glass">
          <div className="toolbar__repo" title={repo.root}>
            <span className="toolbar__name">{repo.name}</span>
            <ProviderBadge provider={repo.provider} remoteUrl={repo.remoteUrl} />
          </div>
          {refs && (
            <span className="branch-chip" title={currentBranch ? `Rama actual: ${currentBranch}` : 'HEAD desacoplado'}>
              <GitBranch size={14} strokeWidth={1.75} aria-hidden />
              {currentBranch ?? 'HEAD desacoplado'}
            </span>
          )}

          <div className="segmented toolbar__views" role="tablist" aria-label="Vista">
            <button
              role="tab"
              aria-selected={view === 'history'}
              className={`segmented__item${view === 'history' ? ' segmented__item--active' : ''}`}
              onClick={() => setView('history')}
            >
              <History size={14} strokeWidth={1.75} aria-hidden />
              Historial
            </button>
            <button
              role="tab"
              aria-selected={view === 'compare'}
              className={`segmented__item${view === 'compare' ? ' segmented__item--active' : ''}`}
              onClick={() => setView('compare')}
            >
              <GitCompareArrows size={14} strokeWidth={1.75} aria-hidden />
              Comparar ramas
            </button>
          </div>

          <div className="toolbar__end">
            <button className="btn" onClick={fetchAll} disabled={fetching} title="Trae las novedades del servidor (git fetch)">
              <RefreshCw size={14} strokeWidth={1.75} className={fetching ? 'spin' : undefined} aria-hidden />
              {fetching ? 'Actualizando…' : 'Actualizar'}
            </button>
            <AppearanceMenu />
          </div>
        </header>

        {error && (
          <div className="banner banner--error" role="alert">
            <span>{error}</span>
            <button className="btn btn--icon btn--ghost" aria-label="Cerrar aviso" onClick={() => setError(null)}>
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        )}

        {refs && (
          <div className="workspace__body">
            {/* Las dos vistas quedan montadas para no perder lo que estabas mirando al cambiar. */}
            <div className="view" hidden={view !== 'history'}>
              <HistoryView
                repo={repo}
                refs={refs}
                reloadKey={reloadKey}
                statusKey={statusKey}
                options={options}
                onOptionsChange={setOptions}
                onError={showError}
                onRepoMutated={reloadRepo}
                onCompare={compare}
              />
            </div>
            <div className="view" hidden={view !== 'compare'}>
              <CompareView
                repo={repo}
                refs={refs}
                reloadKey={reloadKey}
                options={options}
                onOptionsChange={setOptions}
                onError={showError}
                request={compareRequest}
              />
            </div>
          </div>
        )}
      </div>
    </AvatarProvider>
  )
}

function ProviderBadge({ provider, remoteUrl }: { provider: ProviderInfo | null; remoteUrl: string | null }) {
  if (!provider) {
    // Un remoto que es una carpeta (otro clon en el disco) no tiene plataforma.
    return remoteUrl ? (
      <span className="badge" title={remoteUrl}>
        Remoto local
      </span>
    ) : (
      <span className="badge">Sin remoto</span>
    )
  }
  return (
    <span className={`badge badge--${provider.id}`} title={`${provider.host}/${provider.repoPath}`}>
      {provider.name}
    </span>
  )
}
