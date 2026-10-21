import { useState, type KeyboardEvent } from 'react'
import type { WorkingArea, WorkingFile, WorkingTreeStatus } from '../../../shared/types'
import { api } from '../api'
import { STATUS_META } from '../lib/status'

export interface CommitDraft {
  summary: string
  description: string
  amend: boolean
}

export const EMPTY_DRAFT: CommitDraft = { summary: '', description: '', amend: false }

/** Largo recomendado para el resumen de un commit (se ve completo en casi todas las herramientas). */
const SUMMARY_LIMIT = 72

interface Props {
  root: string
  status: WorkingTreeStatus
  /** Archivo abierto en el centro, para marcarlo en la lista. */
  openFile: { path: string; area: WorkingArea } | null
  draft: CommitDraft
  onDraftChange(draft: CommitDraft): void
  onOpenFile(file: WorkingFile, area: WorkingArea): void
  /** Se llama después de preparar, quitar o descartar, para refrescar el estado. */
  onChanged(): void
  onCommitted(sha: string): void
  onError(message: string): void
}

/** Panel derecho de la fila WIP: preparar archivos y hacer commit, como en GitKraken. */
export function WorkingTreePanel({ root, status, openFile, draft, onDraftChange, onOpenFile, onChanged, onCommitted, onError }: Props) {
  const [busy, setBusy] = useState(false)

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
      onChanged()
    }
  }

  const stage = (files: WorkingFile[]) => run(() => api.stageFiles(root, files.map((f) => f.path)))
  const unstage = (files: WorkingFile[]) =>
    run(() => api.unstageFiles(root, files.flatMap((f) => (f.oldPath ? [f.oldPath, f.path] : [f.path]))))
  const discard = (files: WorkingFile[]) =>
    run(async () => {
      const untracked = files.filter((f) => f.untracked).length
      const confirmed = await api.confirm({
        title: 'Descartar cambios',
        message:
          files.length === 1
            ? `¿Descartar los cambios sin preparar de "${fileName(files[0].path)}"?`
            : `¿Descartar los cambios sin preparar de ${files.length} archivos?`,
        detail:
          untracked > 0
            ? 'Los cambios en archivos con seguimiento no se pueden recuperar. Los archivos nuevos van a la papelera de reciclaje.'
            : 'Los cambios descartados no se pueden recuperar.',
        confirmLabel: 'Descartar'
      })
      if (confirmed) await api.discardFiles(root, files)
    })

  const setAmend = async (amend: boolean) => {
    // Al enmendar, si no hay nada escrito se trae el mensaje del último commit para editarlo.
    if (amend && !draft.summary.trim() && !draft.description.trim()) {
      try {
        const [summary, ...rest] = (await api.lastCommitMessage(root)).split('\n')
        onDraftChange({ summary, description: rest.join('\n').trim(), amend })
        return
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error))
      }
    }
    onDraftChange({ ...draft, amend })
  }

  const canCommit = !busy && draft.summary.trim() !== '' && (status.staged.length > 0 || draft.amend) && status.conflicted.length === 0

  const doCommit = () => {
    if (!canCommit) return
    const message = draft.description.trim() ? `${draft.summary.trim()}\n\n${draft.description.trim()}\n` : `${draft.summary.trim()}\n`
    void run(async () => {
      const sha = await api.commit(root, message, draft.amend)
      onDraftChange(EMPTY_DRAFT)
      onCommitted(sha)
    })
  }

  const onCommitKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      doCommit()
    }
  }

  const total = status.staged.length + status.unstaged.length + status.conflicted.length
  const isSelected = (file: WorkingFile, area: WorkingArea) => openFile?.path === file.path && openFile.area === area

  return (
    <div className="wip-panel">
      <div className="wip-panel__header">
        <h2 className="details__subject">Cambios sin commitear</h2>
        <div className="muted small">
          {total} {total === 1 ? 'archivo' : 'archivos'} en {status.branch ? <strong>{status.branch}</strong> : 'HEAD desacoplado'}
        </div>
      </div>

      <div className="wip-panel__lists">
        {status.conflicted.length > 0 && (
          <FileSection
            title="Con conflictos"
            files={status.conflicted}
            area="unstaged"
            note="Resolvé los conflictos en tu editor y después marcá cada archivo como resuelto."
            isSelected={() => false}
            onOpen={() => undefined}
            actions={[{ label: 'Marcar resuelto', title: 'Preparar el archivo (git add)', run: (f) => stage([f]) }]}
            busy={busy}
          />
        )}
        <FileSection
          title="Sin preparar"
          files={status.unstaged}
          area="unstaged"
          headerActions={[
            { label: 'Descartar todo', run: () => discard(status.unstaged) },
            { label: 'Preparar todo', run: () => stage(status.unstaged), accent: true }
          ]}
          actions={[
            { label: '↺', title: 'Descartar cambios', run: (f) => discard([f]) },
            { label: '+', title: 'Preparar', run: (f) => stage([f]), accent: true }
          ]}
          isSelected={(f) => isSelected(f, 'unstaged')}
          onOpen={(f) => onOpenFile(f, 'unstaged')}
          busy={busy}
        />
        <FileSection
          title="Preparados"
          files={status.staged}
          area="staged"
          headerActions={[{ label: 'Quitar todo', run: () => unstage(status.staged) }]}
          actions={[{ label: '−', title: 'Quitar del commit', run: (f) => unstage([f]) }]}
          isSelected={(f) => isSelected(f, 'staged')}
          onOpen={(f) => onOpenFile(f, 'staged')}
          busy={busy}
        />
      </div>

      <div className="commit-box" onKeyDown={onCommitKeyDown}>
        <div className="commit-box__summary">
          <input
            className="filter"
            placeholder="Resumen del commit (obligatorio)"
            value={draft.summary}
            onChange={(e) => onDraftChange({ ...draft, summary: e.target.value })}
            aria-label="Resumen del commit"
          />
          <span
            className={`commit-box__counter${draft.summary.length > SUMMARY_LIMIT ? ' commit-box__counter--over' : ''}`}
            title={`Se recomienda no pasar de ${SUMMARY_LIMIT} caracteres`}
          >
            {draft.summary.length}/{SUMMARY_LIMIT}
          </span>
        </div>
        <textarea
          className="filter commit-box__description"
          placeholder="Descripción (opcional)"
          value={draft.description}
          onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
          rows={4}
          aria-label="Descripción del commit"
        />
        <label className="toggle">
          <input type="checkbox" checked={draft.amend} onChange={(e) => void setAmend(e.target.checked)} disabled={!status.head} />
          Enmendar el último commit
        </label>
        <button className="button button--primary commit-box__button" disabled={!canCommit} onClick={doCommit} title="Ctrl+Enter">
          {draft.amend
            ? 'Enmendar commit'
            : `Hacer commit${status.staged.length > 0 ? ` de ${status.staged.length} ${status.staged.length === 1 ? 'archivo' : 'archivos'}` : ''}`}
        </button>
        {status.conflicted.length > 0 ? (
          <p className="muted small">Hay conflictos sin resolver: resolvelos antes de hacer commit.</p>
        ) : status.staged.length === 0 && !draft.amend ? (
          <p className="muted small">Prepará al menos un archivo para poder hacer commit.</p>
        ) : null}
      </div>
    </div>
  )
}

interface Action {
  label: string
  title?: string
  accent?: boolean
}

interface FileSectionProps {
  title: string
  files: WorkingFile[]
  area: WorkingArea
  note?: string
  headerActions?: (Action & { run(): void })[]
  actions: (Action & { run(file: WorkingFile): void })[]
  isSelected(file: WorkingFile): boolean
  onOpen(file: WorkingFile): void
  busy: boolean
}

function FileSection({ title, files, note, headerActions = [], actions, isSelected, onOpen, busy }: FileSectionProps) {
  return (
    <section className="wip-section">
      <header className="wip-section__header">
        <span className="refs-panel__title">
          {title} <span className="refs-panel__count">({files.length})</span>
        </span>
        {files.length > 0 &&
          headerActions.map((action) => (
            <button
              key={action.label}
              className={`button button--small${action.accent ? ' button--accent' : ''}`}
              disabled={busy}
              onClick={action.run}
            >
              {action.label}
            </button>
          ))}
      </header>
      {note && <p className="wip-section__note muted small">{note}</p>}
      {files.length === 0 ? (
        <p className="wip-section__empty muted small">Ninguno</p>
      ) : (
        <ul className="wip-files">
          {files.map((file) => {
            const meta = STATUS_META[file.status]
            const slash = file.path.lastIndexOf('/')
            return (
              <li key={file.path} className={`wip-file${isSelected(file) ? ' wip-file--selected' : ''}`}>
                <button className="wip-file__open" onClick={() => onOpen(file)} title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>
                  <span
                    className={`status-badge status-badge--${file.untracked ? 'added' : meta.tone}`}
                    title={file.untracked ? 'Archivo nuevo (sin seguimiento)' : meta.label}
                  >
                    {meta.symbol}
                  </span>
                  <span className="wip-file__name">{file.path.slice(slash + 1)}</span>
                  {slash > 0 && <span className="wip-file__dir">{file.path.slice(0, slash)}</span>}
                </button>
                <span className="wip-file__actions">
                  {actions.map((action) => (
                    <button
                      key={action.label}
                      className={`icon-button icon-button--small${action.accent ? ' icon-button--accent' : ''}`}
                      title={action.title}
                      aria-label={`${action.title ?? action.label}: ${file.path}`}
                      disabled={busy}
                      onClick={() => action.run(file)}
                    >
                      {action.label}
                    </button>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}
