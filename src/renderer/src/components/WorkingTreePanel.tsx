import { Check, Minus, Plus, Undo2 } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { WorkingArea, WorkingFile, WorkingTreeStatus } from '../../../shared/types'
import { api } from '../api'
import { StatusBadge } from './StatusBadge'
import { t, tn } from '../../../shared/i18n'
import { tr } from '../lib/i18n'

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
        title: t('Descartar cambios'),
        message:
          files.length === 1
            ? t('¿Descartar los cambios sin preparar de "{value}"?', { value: fileName(files[0].path) })
            : t('¿Descartar los cambios sin preparar de {length} archivos?', { length: files.length }),
        detail:
          untracked > 0
            ? t('Los cambios en archivos con seguimiento no se pueden recuperar. Los archivos nuevos van a la papelera de reciclaje.')
            : t('Los cambios descartados no se pueden recuperar.'),
        confirmLabel: t('Descartar')
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
  const branch = status.branch ? <strong>{status.branch}</strong> : t('HEAD desacoplado')
  const isSelected = (file: WorkingFile, area: WorkingArea) => openFile?.path === file.path && openFile.area === area

  return (
    <div className="wip-panel">
      <div className="wip-panel__header">
        <h2 className="details__subject">{t('Cambios sin commitear')}</h2>
        <div className="text-2 small">
          {total === 1 ? tr('{n} archivo en {branch}', { n: total, branch }) : tr('{n} archivos en {branch}', { n: total, branch })}
        </div>
      </div>

      <div className="wip-panel__lists">
        {status.conflicted.length > 0 && (
          <FileSection
            title={t('Con conflictos')}
            files={status.conflicted}
            area="unstaged"
            note={t('Resolvé los conflictos en tu editor y después marcá cada archivo como resuelto.')}
            isSelected={() => false}
            onOpen={() => undefined}
            actions={[{ label: t('Marcar resuelto'), icon: <Check size={13} strokeWidth={2.25} />, title: t('Marcar como resuelto (preparar)'), run: (f) => stage([f]), accent: true, text: true }]}
            busy={busy}
          />
        )}
        <FileSection
          title={t('Sin preparar')}
          files={status.unstaged}
          area="unstaged"
          headerActions={[
            { label: t('Descartar todo'), run: () => discard(status.unstaged) },
            { label: t('Preparar todo'), run: () => stage(status.unstaged), accent: true }
          ]}
          actions={[
            { label: t('Descartar'), icon: <Undo2 size={14} strokeWidth={1.75} />, title: t('Descartar cambios'), run: (f) => discard([f]) },
            { label: t('Preparar archivo'), icon: <Plus size={13} strokeWidth={2.25} />, run: (f) => stage([f]), accent: true, text: true }
          ]}
          isSelected={(f) => isSelected(f, 'unstaged')}
          onOpen={(f) => onOpenFile(f, 'unstaged')}
          busy={busy}
        />
        <FileSection
          title={t('Preparados')}
          files={status.staged}
          area="staged"
          headerActions={[{ label: t('Quitar todo'), run: () => unstage(status.staged) }]}
          actions={[{ label: t('Quitar archivo'), icon: <Minus size={13} strokeWidth={2.25} />, title: t('Quitar del commit'), run: (f) => unstage([f]), text: true }]}
          isSelected={(f) => isSelected(f, 'staged')}
          onOpen={(f) => onOpenFile(f, 'staged')}
          busy={busy}
        />
      </div>

      <div className="commit-box" onKeyDown={onCommitKeyDown}>
        <div className="commit-box__summary">
          <input
            className="field"
            placeholder={t('Resumen del commit (obligatorio)')}
            value={draft.summary}
            onChange={(e) => onDraftChange({ ...draft, summary: e.target.value })}
            aria-label={t('Resumen del commit')}
          />
          <span
            className={`commit-box__counter${draft.summary.length > SUMMARY_LIMIT ? ' commit-box__counter--over' : ''}`}
            title={t('Se recomienda no pasar de {SUMMARY_LIMIT} caracteres', { SUMMARY_LIMIT })}
          >
            {draft.summary.length}/{SUMMARY_LIMIT}
          </span>
        </div>
        <textarea
          className="field commit-box__description"
          placeholder={t('Descripción (opcional)')}
          value={draft.description}
          onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
          rows={4}
          aria-label={t('Descripción del commit')}
        />
        <label className="toggle">
          <input type="checkbox" checked={draft.amend} onChange={(e) => void setAmend(e.target.checked)} disabled={!status.head} />
          {t('Enmendar el último commit')}
        </label>
        <button className="btn btn--primary btn--lg commit-box__button" disabled={!canCommit} onClick={doCommit} title="Ctrl+Enter">
          {draft.amend
            ? t('Enmendar commit')
            : status.staged.length > 0
              ? tn(status.staged.length, 'Hacer commit de {n} archivo', 'Hacer commit de {n} archivos')
              : t('Hacer commit')}
        </button>
        {status.conflicted.length > 0 ? (
          <p className="text-2 small">{t('Hay conflictos sin resolver: resolvelos antes de hacer commit.')}</p>
        ) : status.staged.length === 0 && !draft.amend ? (
          <p className="text-2 small">{t('Prepará al menos un archivo para poder hacer commit.')}</p>
        ) : null}
      </div>
    </div>
  )
}

interface Action {
  label: string
  /** En las acciones de cada archivo se muestra solo el ícono (el texto queda para lectores de pantalla)… */
  icon?: ReactNode
  title?: string
  accent?: boolean
  /** …salvo la acción principal, que va con texto: "Preparar archivo", como en GitKraken. */
  text?: boolean
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
        <span className="wip-section__title">
          {title} <span className="wip-section__count">{files.length}</span>
        </span>
        {files.length > 0 &&
          headerActions.map((action) => (
            <button
              key={action.label}
              className={`btn btn--sm${action.accent ? ' btn--primary' : ''}`}
              disabled={busy}
              onClick={action.run}
            >
              {action.label}
            </button>
          ))}
      </header>
      {note && <p className="wip-section__note text-2 small">{note}</p>}
      {files.length === 0 ? (
        <p className="wip-section__empty text-2 small">{t('Ninguno')}</p>
      ) : (
        <ul className="wip-files">
          {files.map((file) => {
            const slash = file.path.lastIndexOf('/')
            return (
              <li key={file.path} className={`wip-file${isSelected(file) ? ' wip-file--selected' : ''}`}>
                <button className="wip-file__open" onClick={() => onOpen(file)} title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>
                  <StatusBadge status={file.status} title={file.untracked ? t('Archivo nuevo (sin seguimiento)') : undefined} />
                  <span className="wip-file__name">{file.path.slice(slash + 1)}</span>
                  {slash > 0 && <span className="wip-file__dir">{file.path.slice(0, slash)}</span>}
                </button>
                <span className="wip-file__actions">
                  {actions.map((action) => (
                    <button
                      key={action.label}
                      className={
                        action.text
                          ? `btn btn--sm wip-file__action${action.accent ? ' wip-file__action--accent' : ''}`
                          : `btn btn--icon btn--sm btn--ghost${action.accent ? ' btn--accent-icon' : ''}`
                      }
                      title={action.title}
                      aria-label={`${action.title ?? action.label}: ${file.path}`}
                      disabled={busy}
                      onClick={() => action.run(file)}
                    >
                      {action.text ? (
                        <>
                          {action.icon}
                          {action.label}
                        </>
                      ) : (
                        (action.icon ?? action.label)
                      )}
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
