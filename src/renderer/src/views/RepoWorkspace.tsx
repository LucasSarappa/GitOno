import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Code,
  Command as CommandIcon,
  FolderOpen,
  GitBranch,
  GitBranchPlus,
  GitCompareArrows,
  History,
  LoaderCircle,
  Keyboard,
  LogIn,
  Palette,
  PackageOpen,
  Redo2,
  SquareTerminal,
  Timer,
  ZoomIn,
  TriangleAlert,
  Undo2,
  X
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GraphFilter, ProviderInfo, RefList, RepoInfo, StashInfo, WorkingTreeStatus } from '../../../shared/types'
import { api } from '../api'
import { AppearanceMenu } from '../components/AppearanceMenu'
import { CommandPalette, type Command } from '../components/CommandPalette'
import { useDialog } from '../components/Dialog'
import { useAppearance } from '../lib/appearance'
import { PALETTES } from '../lib/themes'
import { useContextMenu, type MenuItem } from '../components/ContextMenu'
import type { DiffOptions } from '../components/DiffView'
import { AvatarProvider } from '../lib/avatars'
import { loadSetting, saveSetting } from '../lib/settings'
import { CompareView, type CompareRequest } from './CompareView'
import { HistoryView, type ShowRequest, type ShowTarget } from './HistoryView'
import { PULL_MODES, shortRef, useRepoActions } from './useRepoActions'

type View = 'history' | 'compare'

const DEFAULT_OPTIONS: DiffOptions = { sideBySide: true, ignoreWhitespace: false, hideUnchanged: true }
const NO_FILTER: GraphFilter = { hidden: [], solo: [] }

const AUTO_FETCH = [
  { minutes: 0, label: 'Apagado' },
  { minutes: 5, label: 'Cada 5 minutos' },
  { minutes: 15, label: 'Cada 15 minutos' },
  { minutes: 30, label: 'Cada 30 minutos' }
]

const SHORTCUTS: [string, string][] = [
  ['Ctrl+P', 'Paleta de comandos: todo lo que se puede hacer, buscando'],
  ['Ctrl+F', 'Buscar commits'],
  ['Ctrl+Z', 'Deshacer la última operación'],
  ['Ctrl+Y', 'Rehacer'],
  ['Ctrl+K', 'Mostrar u ocultar el panel de ramas'],
  ['Ctrl+J', 'Mostrar u ocultar el panel de detalle'],
  ['Ctrl+T', 'Pestaña nueva'],
  ['Ctrl+W', 'Cerrar la pestaña'],
  ['Ctrl+Tab', 'Pasar a la pestaña siguiente'],
  ['Ctrl+O', 'Abrir un repo'],
  ['Ctrl+= Ctrl+−', 'Agrandar y achicar (Ctrl+0 vuelve a 100 %)'],
  ['↑ ↓', 'Moverse por los commits'],
  ['Shift+F10', 'Menú del commit elegido (también la tecla Menú)'],
  ['Ctrl+Enter', 'Hacer el commit, desde la caja de mensaje'],
  ['Esc', 'Volver del diff, cerrar un menú o dejar de resaltar una rama']
]

const OPERATION_NAMES = { merge: 'Merge', rebase: 'Rebase', 'cherry-pick': 'Cherry-pick', revert: 'Revert' }

interface Props {
  repo: RepoInfo
  /** Es la pestaña visible: solo esa se refresca al volver a la ventana y responde a los atajos. */
  active: boolean
}

/** Todo lo de un repo abierto en una pestaña: barra de herramientas, historial y comparación. */
export function RepoWorkspace({ repo, active }: Props) {
  const root = repo.root
  const [refs, setRefs] = useState<RefList | null>(null)
  const [status, setStatus] = useState<WorkingTreeStatus | null>(null)
  // Sube cada vez que llega un estado nuevo: los diffs de archivos locales se releen con él.
  const [statusVersion, setStatusVersion] = useState(0)
  const [stashes, setStashes] = useState<StashInfo[]>([])
  const [remotes, setRemotes] = useState<string[]>([])
  const [view, setView] = useState<View>('history')
  const [error, setError] = useState<string | null>(null)
  // reloadKey relee ramas e historial (fetch, commit, ramas cambiadas); statusKey, la carpeta de trabajo.
  const [reloadKey, setReloadKey] = useState(0)
  const [statusKey, setStatusKey] = useState(0)
  const [options, setOptions] = useState<DiffOptions>(() => loadSetting('diffOptions', DEFAULT_OPTIONS))
  const [compareRequest, setCompareRequest] = useState<CompareRequest | null>(null)
  const [showRequest, setShowRequest] = useState<ShowRequest | null>(null)
  const [filter, setFilterState] = useState<GraphFilter>(() => loadSetting(`graphFilter:${root}`, NO_FILTER))
  const nonce = useRef(0)
  const menu = useContextMenu()
  const pullMenuButton = useRef<HTMLButtonElement>(null)
  // Lugar de la barra donde el historial pone su búsqueda.
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const dialog = useDialog()
  const { choosePalette, update: updateAppearance, zoomBy } = useAppearance()

  useEffect(() => saveSetting('diffOptions', options), [options])

  const setFilter = useCallback(
    (next: GraphFilter) => {
      setFilterState(next)
      saveSetting(`graphFilter:${root}`, next)
    },
    [root]
  )

  const showError = useCallback((message: string | null) => setError(message), [])

  const loadRefs = useCallback(() => {
    api.listRefs(root).then(setRefs, (e: Error) => setError(e.message))
    api.listStashes(root).then(setStashes, () => setStashes([]))
    api.listRemotes(root).then(setRemotes, () => setRemotes([]))
  }, [root])

  const reloadRepo = useCallback(() => {
    loadRefs()
    setReloadKey((k) => k + 1)
    setStatusKey((k) => k + 1)
  }, [loadRefs])

  const refreshStatus = useCallback(() => setStatusKey((k) => k + 1), [])

  useEffect(loadRefs, [loadRefs])

  useEffect(() => {
    let cancelled = false
    api.workingStatus(root).then(
      (result) => {
        if (cancelled) return
        setStatus(result)
        setStatusVersion((v) => v + 1)
      },
      (e: Error) => !cancelled && setError(e.message)
    )
    return () => {
      cancelled = true
    }
  }, [root, statusKey])

  // Se refresca sola cuando cambia algo en el repo (desde GitOno, la terminal o el editor).
  useEffect(() => {
    api.watchRepo(root).catch((e: Error) => setError(e.message))
    const stop = api.onRepoChanged((changed, change) => {
      if (changed !== root) return
      if (change === 'refs') reloadRepo()
      else setStatusKey((k) => k + 1)
    })
    return () => {
      stop()
      void api.unwatchRepo(root)
    }
  }, [root, reloadRepo])

  // Al volver a la ventana, por si algo cambió mientras no se miraba.
  useEffect(() => {
    if (!active) return
    const onFocus = () => setStatusKey((k) => k + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [active])

  const compare = useCallback((refA: string, refB: string) => {
    setCompareRequest({ refA, refB, nonce: Date.now() })
    setView('compare')
  }, [])

  const show = useCallback((target: ShowTarget) => {
    setView('history')
    setShowRequest({ ...target, nonce: ++nonce.current })
  }, [])

  const actions = useRepoActions({
    repo,
    active,
    refs: refs ?? { current: null, head: null, refs: [] },
    status,
    stashes,
    remotes,
    filter,
    onFilterChange: setFilter,
    reload: reloadRepo,
    onError: showError,
    onCompare: compare,
    onShowCommit: (sha) => show({ kind: 'commit', sha }),
    onShowBranch: (ref) => show({ kind: 'branch', ref })
  })

  const currentBranch = refs?.current ? shortRef(refs.current) : null
  const conflicted = status?.conflicted.length ?? 0
  const operation = status?.operation ?? null
  const busy = actions.busy !== null

  const openPullMenu = () => {
    const items: MenuItem[] = [
      { label: 'Traer novedades de todos los remotos (fetch)', icon: ArrowDownToLine, onSelect: actions.fetchAll },
      {
        kind: 'submenu',
        label: 'Fetch automático',
        icon: Timer,
        items: AUTO_FETCH.map(({ minutes, label }): MenuItem => ({
          kind: 'check',
          label,
          checked: actions.autoFetch === minutes,
          onSelect: () => actions.setAutoFetch(minutes)
        }))
      },
      { kind: 'separator' },
      ...PULL_MODES.map(({ mode, label }): MenuItem => ({ label, onSelect: () => actions.pull(mode) })),
      { kind: 'separator' },
      {
        kind: 'submenu',
        label: 'Al tocar Pull',
        items: PULL_MODES.map(({ mode, label }): MenuItem => ({ kind: 'check', label, checked: actions.pullMode === mode, onSelect: () => actions.setPullMode(mode) }))
      }
    ]
    menu.open(pullMenuButton.current!.getBoundingClientRect(), items)
  }

  const openRepoMenu = (at: DOMRect) =>
    menu.open(at, [
      { kind: 'label', label: root },
      { label: 'Abrir la carpeta', icon: FolderOpen, onSelect: () => actions.openIn('folder') },
      { label: 'Abrir una terminal acá', icon: SquareTerminal, onSelect: () => actions.openIn('terminal') },
      { label: 'Abrir en VS Code', icon: Code, onSelect: () => actions.openIn('editor') },
      { kind: 'separator' },
      { label: 'Copiar la ruta', onSelect: () => void api.copyText(root) }
    ])

  const showShortcuts = () =>
    void dialog.show({
      title: 'Atajos de teclado',
      description: (
        <dl className="shortcuts">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys}>
              <dt>
                {keys.split(' ').map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      ),
      confirmLabel: 'Listo'
    })

  // Ctrl+P (o Ctrl+Shift+P) abre la paleta de comandos de la pestaña visible.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'p') return
      e.preventDefault()
      setPaletteOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  const commands = (): Command[] => {
    const list: Command[] = [
      { id: 'pull', group: 'Git', label: 'Pull', icon: ArrowDownToLine, run: () => actions.pull() },
      ...PULL_MODES.map((m): Command => ({ id: `pull-${m.mode}`, group: 'Git', label: m.label, icon: ArrowDownToLine, run: () => actions.pull(m.mode) })),
      { id: 'fetch', group: 'Git', label: 'Fetch: traer novedades de todos los remotos', icon: ArrowDownToLine, run: actions.fetchAll },
      ...(refs?.current ? [{ id: 'push', group: 'Git', label: 'Push', icon: ArrowUpFromLine, run: () => actions.push(refs.current!) }] : []),
      ...(refs?.head ? [{ id: 'branch', group: 'Git', label: 'Crear una rama', icon: GitBranchPlus, run: () => void actions.createBranchAt(refs.head!, currentBranch ?? 'el commit actual') }] : []),
      { id: 'stash', group: 'Git', label: 'Guardar los cambios en un stash', icon: Archive, run: () => void actions.stashChanges() },
      ...(actions.latestStash ? [{ id: 'pop', group: 'Git', label: 'Pop: aplicar y borrar el último stash', icon: PackageOpen, run: () => actions.applyStash(actions.latestStash!, true) }] : []),
      ...(actions.undoLabel ? [{ id: 'undo', group: 'Git', label: `Deshacer: ${actions.undoLabel}`, icon: Undo2, hint: 'Ctrl+Z', run: actions.undo }] : []),
      ...(actions.redoLabel ? [{ id: 'redo', group: 'Git', label: `Rehacer: ${actions.redoLabel}`, icon: Redo2, hint: 'Ctrl+Y', run: actions.redo }] : []),
      { id: 'view-history', group: 'Vista', label: 'Historial', icon: History, run: () => setView('history') },
      { id: 'view-compare', group: 'Vista', label: 'Comparar ramas', icon: GitCompareArrows, run: () => setView('compare') },
      { id: 'open-folder', group: 'Abrir', label: 'Abrir la carpeta del repo', icon: FolderOpen, run: () => actions.openIn('folder') },
      { id: 'open-terminal', group: 'Abrir', label: 'Abrir una terminal en el repo', icon: SquareTerminal, run: () => actions.openIn('terminal') },
      { id: 'open-editor', group: 'Abrir', label: 'Abrir el repo en VS Code', icon: Code, run: () => actions.openIn('editor') },
      ...PALETTES.map((p): Command => ({ id: `theme-${p.id}`, group: 'Tema', label: `${p.name} (${p.kind === 'dark' ? 'oscuro' : 'claro'})`, icon: Palette, run: () => choosePalette(p.id) })),
      { id: 'mode-system', group: 'Tema', label: 'Seguir el modo del sistema', icon: Palette, run: () => updateAppearance({ theme: 'system' }) },
      { id: 'zoom-in', group: 'Zoom', label: 'Agrandar', icon: ZoomIn, hint: 'Ctrl +', run: () => zoomBy(1) },
      { id: 'zoom-out', group: 'Zoom', label: 'Achicar', icon: ZoomIn, hint: 'Ctrl −', run: () => zoomBy(-1) },
      { id: 'zoom-reset', group: 'Zoom', label: 'Volver a 100 %', icon: ZoomIn, hint: 'Ctrl 0', run: () => zoomBy(0) },
      { id: 'shortcuts', group: 'Ayuda', label: 'Atajos de teclado', icon: Keyboard, run: showShortcuts }
    ]
    for (const ref of refs?.refs ?? []) {
      if (ref.kind === 'tag') continue
      if (ref.ref !== refs?.current) {
        list.push({ id: `checkout-${ref.ref}`, group: 'Checkout', label: ref.name, icon: LogIn, run: () => actions.checkout(ref.ref) })
      }
      list.push({ id: `show-${ref.ref}`, group: 'Ver rama', label: ref.name, icon: GitBranch, run: () => show({ kind: 'branch', ref: ref.ref }) })
    }
    return list
  }

  const pullTitle = PULL_MODES.find((m) => m.mode === actions.pullMode)
  const upstreamText = status?.upstream ? `Sigue a ${status.upstream}` : 'La rama no sigue ninguna rama remota'

  return (
    <AvatarProvider root={root} provider={repo.provider}>
      <div className="workspace">
        <header className="toolbar glass">
          <div className="toolbar__repo">
            <button className="toolbar__name" title={`${root}\nClic: abrir la carpeta, una terminal o VS Code`} onClick={(e) => openRepoMenu(e.currentTarget.getBoundingClientRect())}>
              {repo.name}
            </button>
            <ProviderBadge provider={repo.provider} remoteUrl={repo.remoteUrl} />
          </div>
          {refs && (
            <span className="branch-chip" title={currentBranch ? `Rama actual: ${currentBranch}. ${upstreamText}.` : 'HEAD desacoplado'}>
              <GitBranch size={14} strokeWidth={1.75} aria-hidden />
              <span className="branch-chip__name">{currentBranch ?? 'HEAD desacoplado'}</span>
            </span>
          )}

          <div className="toolbar__actions" role="toolbar" aria-label="Operaciones">
            <ToolButton
              icon={Undo2}
              label="Deshacer"
              title={actions.undoLabel ? `Deshacer: ${actions.undoLabel} (Ctrl+Z)` : 'Nada para deshacer'}
              disabled={busy || !actions.undoLabel}
              onClick={actions.undo}
            />
            <ToolButton
              icon={Redo2}
              label="Rehacer"
              title={actions.redoLabel ? `Rehacer: ${actions.redoLabel} (Ctrl+Y)` : 'Nada para rehacer'}
              disabled={busy || !actions.redoLabel}
              onClick={actions.redo}
            />
            <span className="toolbar__divider" aria-hidden />
            <div className="split-button">
              <ToolButton
                icon={ArrowDownToLine}
                label="Pull"
                count={status?.behind}
                title={`${pullTitle?.label ?? 'Pull'}: ${pullTitle?.detail ?? ''} ${upstreamText}.`}
                disabled={busy || !refs?.current}
                onClick={() => actions.pull()}
              />
              <button
                ref={pullMenuButton}
                className="btn btn--ghost btn--icon split-button__more"
                aria-label="Opciones de pull"
                title="Fetch y otras formas de pull"
                disabled={busy}
                onClick={openPullMenu}
              >
                <ChevronDown size={13} strokeWidth={2} />
              </button>
            </div>
            <ToolButton
              icon={ArrowUpFromLine}
              label="Push"
              count={status?.ahead}
              title={refs?.current ? (status?.upstream ? `Subir ${currentBranch} a ${status.upstream}` : `Publicar ${currentBranch} en el servidor`) : 'Hacé checkout de una rama para subirla'}
              disabled={busy || !refs?.current || remotes.length === 0}
              onClick={() => refs?.current && actions.push(refs.current)}
            />
            <span className="toolbar__divider" aria-hidden />
            <ToolButton
              icon={GitBranchPlus}
              label="Rama"
              title="Crear una rama desde el commit actual"
              disabled={busy || !refs?.head}
              onClick={() => refs?.head && void actions.createBranchAt(refs.head, currentBranch ?? 'el commit actual')}
            />
            <ToolButton
              icon={Archive}
              label="Stash"
              title={actions.hasChanges ? 'Guardar los cambios sin commitear en un stash' : 'No hay cambios para guardar'}
              disabled={busy || !actions.hasChanges}
              onClick={() => void actions.stashChanges()}
            />
            <ToolButton
              icon={PackageOpen}
              label="Pop"
              title={actions.latestStash ? `Aplicar y borrar el último stash: "${actions.latestStash.message}"` : 'No hay stashes guardados'}
              disabled={busy || !actions.latestStash}
              onClick={() => actions.latestStash && actions.applyStash(actions.latestStash, true)}
            />
            {actions.busy && (
              <span className="toolbar__busy" role="status">
                <LoaderCircle size={14} strokeWidth={2} className="spin" aria-hidden />
                {actions.busy}
                {actions.progress && (
                  <span className="toolbar__progress">
                    {actions.progress.phase} {actions.progress.percent} %
                    <span className="toolbar__progress-bar" aria-hidden>
                      <span style={{ width: `${actions.progress.percent}%` }} />
                    </span>
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="toolbar__search" ref={setSearchSlot} />

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
              Comparar
            </button>
          </div>
          <div className="toolbar__end">
            <button className="btn btn--icon btn--ghost" aria-label="Paleta de comandos" title="Paleta de comandos (Ctrl+P)" onClick={() => setPaletteOpen(true)}>
              <CommandIcon size={16} strokeWidth={1.75} />
            </button>
            <AppearanceMenu />
          </div>
        </header>

        {(operation || conflicted > 0) && (
          <div className="banner banner--warning" role="status">
            <TriangleAlert size={15} strokeWidth={1.75} aria-hidden />
            <span>
              {operation ? `${OPERATION_NAMES[operation]} a medio hacer. ` : ''}
              {conflicted > 0
                ? `${conflicted === 1 ? 'Hay 1 archivo' : `Hay ${conflicted} archivos`} con conflictos: resolvelos en tu editor y preparalos${operation ? ' para continuar' : ''}.`
                : 'Ya no quedan conflictos: tocá Continuar para terminar.'}
            </span>
            <span className="banner__actions">
              {conflicted > 0 && (
                <button className="btn btn--sm" onClick={() => show({ kind: 'wip' })}>
                  Ver archivos
                </button>
              )}
              {operation && (
                <>
                  <button className="btn btn--sm" disabled={busy} onClick={() => void actions.abortOperation()}>
                    Abortar
                  </button>
                  <button
                    className="btn btn--sm btn--primary"
                    disabled={busy || conflicted > 0}
                    title={conflicted > 0 ? 'Primero resolvé y prepará los archivos con conflictos' : undefined}
                    onClick={actions.continueOperation}
                  >
                    Continuar
                  </button>
                </>
              )}
            </span>
          </div>
        )}

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
                active={view === 'history'}
                searchSlot={searchSlot}
                refs={refs}
                status={status}
                statusVersion={statusVersion}
                stashes={stashes}
                filter={filter}
                onFilterChange={setFilter}
                reloadKey={reloadKey}
                options={options}
                showRequest={showRequest}
                menus={actions.menus}
                onOptionsChange={setOptions}
                onError={showError}
                onRefreshStatus={refreshStatus}
                onRepoMutated={reloadRepo}
                onCommitted={actions.recordCommit}
                onCheckout={actions.checkout}
                onShowAll={actions.showAll}
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

        {paletteOpen && <CommandPalette commands={commands()} onClose={() => setPaletteOpen(false)} />}

        {actions.toast && (
          <div className="toast glass" role="status" key={actions.toast.id}>
            <span>{actions.toast.message}</span>
            {actions.toast.undoable && (
              <button className="btn btn--sm" disabled={busy} onClick={actions.undo}>
                Deshacer
              </button>
            )}
            <button className="btn btn--icon btn--ghost" aria-label="Cerrar aviso" onClick={actions.dismissToast}>
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </AvatarProvider>
  )
}

interface ToolButtonProps {
  icon: typeof Undo2
  label: string
  title: string
  disabled?: boolean
  /** Commits para subir o bajar: se muestra como un numerito al lado. */
  count?: number
  onClick(): void
}

/** Botón de la barra, con ícono y texto (el texto se oculta si la ventana es angosta). */
function ToolButton({ icon: Icon, label, title, disabled, count, onClick }: ToolButtonProps) {
  return (
    <button className="btn btn--ghost tool-button" title={title} aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon size={15} strokeWidth={1.75} aria-hidden />
      <span className="tool-button__label">{label}</span>
      {count !== undefined && count > 0 && <span className="tool-button__count">{count}</span>}
    </button>
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
