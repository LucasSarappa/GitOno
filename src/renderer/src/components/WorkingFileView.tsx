import { useEffect, useState } from 'react'
import { buildPatch, parseFileDiff, type FileDiff, type LineSelection } from '../../../shared/patch'
import type { FileSource, PatchAction, WorkingArea, WorkingFile } from '../../../shared/types'
import { api } from '../api'
import { STATUS_META } from '../lib/status'
import { DiffView, type DiffOptions } from './DiffView'
import { EmptyState } from './EmptyState'
import { HunkView } from './HunkView'

interface Props {
  root: string
  file: WorkingFile
  area: WorkingArea
  /** Cambia cuando hay que releer el archivo (por ejemplo, se editó en el disco). */
  reloadKey: number
  options: DiffOptions
  onOptionsChange(options: DiffOptions): void
  onBack(): void
  /** Se llama después de preparar, quitar o descartar algo, para refrescar el estado. */
  onChanged(): void
  onError(message: string): void
}

type Mode = 'hunks' | 'side'

const AREA_LABEL: Record<WorkingArea, string> = { unstaged: 'Sin preparar', staged: 'Preparado' }

/** Cambios locales de un archivo, en el centro de la pantalla. */
export function WorkingFileView({ root, file, area, reloadKey, options, onOptionsChange, onBack, onChanged, onError }: Props) {
  // Por bloques solo se pueden manejar archivos modificados; los nuevos, borrados o renombrados van enteros.
  const canUseHunks = file.status === 'modified' && !file.untracked
  const [mode, setMode] = useState<Mode>('hunks')
  const [diff, setDiff] = useState<FileDiff | null>(null)
  const [busy, setBusy] = useState(false)
  const showHunks = canUseHunks && mode === 'hunks'

  useEffect(() => {
    if (!showHunks) return
    let cancelled = false
    api.workingDiff(root, file.path, area).then(
      (text) => !cancelled && setDiff(parseFileDiff(text)),
      (error: Error) => !cancelled && onError(error.message)
    )
    return () => {
      cancelled = true
    }
  }, [root, file.path, area, reloadKey, showHunks, onError])

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
      onChanged()
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const name = file.path.slice(file.path.lastIndexOf('/') + 1)

  const confirmDiscard = (what: string) =>
    api.confirm({
      title: 'Descartar cambios',
      message: `¿Descartar ${what} de "${name}"?`,
      detail: file.untracked
        ? 'El archivo va a ir a la papelera de reciclaje.'
        : 'Los cambios descartados no se pueden recuperar.',
      confirmLabel: 'Descartar'
    })

  const applyLines = (action: PatchAction, selection: LineSelection, lineCount: number | null) => {
    if (!diff) return
    const patch = buildPatch(diff, selection, action === 'stage' ? 'forward' : 'reverse')
    if (!patch) return
    void run(async () => {
      const what = lineCount ? `${lineCount} ${lineCount === 1 ? 'línea' : 'líneas'}` : 'este bloque'
      if (action === 'discard' && !(await confirmDiscard(what))) return
      await api.applyPatch(root, patch, action)
    })
  }

  const stageWhole = () => run(() => api.stageFiles(root, [file.path]))
  const unstageWhole = () => run(() => api.unstageFiles(root, file.oldPath ? [file.oldPath, file.path] : [file.path]))
  const discardWhole = () =>
    run(async () => {
      if (await confirmDiscard('todos los cambios sin preparar')) await api.discardFiles(root, [file])
    })

  // Lado a lado: preparado = último commit contra índice; sin preparar = índice contra disco.
  const sides: [FileSource, FileSource, string, string] =
    area === 'staged'
      ? [{ kind: 'ref', ref: 'HEAD' }, { kind: 'index' }, 'último commit', 'preparado']
      : [{ kind: 'index' }, { kind: 'worktree' }, 'preparado', 'carpeta de trabajo']

  const meta = STATUS_META[file.status]
  const noChangesLeft = showHunks && diff !== null && diff.hunks.length === 0 && !diff.binary

  return (
    <div className="working-file">
      <div className="history__back">
        <button className="button button--small" onClick={onBack}>
          ← Volver al historial
        </button>
        <span className={`status-badge status-badge--${meta.tone}`} title={file.untracked ? 'Archivo nuevo' : meta.label}>
          {meta.symbol}
        </span>
        <strong className="working-file__path" title={file.path}>
          {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
        </strong>
        <span className={`area-badge area-badge--${area}`}>{AREA_LABEL[area]}</span>
        <span className="working-file__spacer" />
        {canUseHunks && (
          <div className="segmented" role="tablist" aria-label="Modo de vista">
            <button role="tab" aria-selected={mode === 'hunks'} className={mode === 'hunks' ? 'active' : ''} onClick={() => setMode('hunks')}>
              Bloques
            </button>
            <button role="tab" aria-selected={mode === 'side'} className={mode === 'side' ? 'active' : ''} onClick={() => setMode('side')}>
              Comparar
            </button>
          </div>
        )}
        {area === 'unstaged' ? (
          <>
            <button className="button button--small" disabled={busy} onClick={discardWhole}>
              Descartar archivo
            </button>
            <button className="button button--small button--accent" disabled={busy} onClick={stageWhole}>
              Preparar archivo
            </button>
          </>
        ) : (
          <button className="button button--small" disabled={busy} onClick={unstageWhole}>
            Quitar archivo
          </button>
        )}
      </div>

      <div className="working-file__body">
        {showHunks ? (
          diff === null ? (
            <EmptyState title="Cargando cambios…" />
          ) : noChangesLeft ? (
            <EmptyState title={area === 'unstaged' ? 'No quedan cambios sin preparar' : 'No quedan cambios preparados'}>
              Este archivo ya no tiene cambios en esta sección.
            </EmptyState>
          ) : diff.binary ? (
            <EmptyState title="Archivo binario">Solo se puede preparar o descartar entero.</EmptyState>
          ) : (
            <HunkView diff={diff} area={area} busy={busy} onAction={applyLines} />
          )
        ) : (
          <DiffView
            root={root}
            left={sides[0]}
            right={sides[1]}
            labelA={sides[2]}
            labelB={sides[3]}
            change={file}
            options={options}
            onOptionsChange={onOptionsChange}
            reloadKey={reloadKey}
          />
        )}
      </div>
    </div>
  )
}
