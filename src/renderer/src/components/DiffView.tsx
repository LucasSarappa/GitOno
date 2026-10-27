import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FileChange, FileContent, FileSource } from '../../../shared/types'
import { api } from '../api'
import { languageFor, monaco } from '../monaco'
import { StatusBadge } from './StatusBadge'
import { t } from '../../../shared/i18n'

export interface DiffOptions {
  sideBySide: boolean
  ignoreWhitespace: boolean
  hideUnchanged: boolean
}

interface Props {
  root: string
  /** De dónde sale cada lado: un commit o rama, el índice o la carpeta de trabajo. */
  left: FileSource
  right: FileSource
  labelA: string
  labelB: string
  change: Pick<FileChange, 'status' | 'path' | 'oldPath'>
  options: DiffOptions
  onOptionsChange(options: DiffOptions): void
  /** Si cambia, se vuelve a leer el archivo aunque sea el mismo (ej. se editó en el disco). */
  reloadKey?: number
}

/** Clave estable de un origen, para no recargar cada vez que se crea un objeto nuevo igual. */
const sourceKey = (source: FileSource): string => (source.kind === 'ref' ? `ref:${source.ref}` : source.kind)

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; left: FileContent; right: FileContent }
  | { status: 'error'; message: string }

const MISSING: FileContent = { kind: 'missing' }

function textOf(content: FileContent): string | null {
  if (content.kind === 'text') return content.text
  if (content.kind === 'missing') return ''
  return null
}

export function DiffView({ root, left, right, labelA, labelB, change, options, onOptionsChange, reloadKey = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  // El editor se crea una sola vez; al cambiar de archivo solo se reemplazan los modelos.
  useEffect(() => {
    const editor = monaco.editor.createDiffEditor(containerRef.current!, {
      readOnly: true,
      originalEditable: false,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      renderOverviewRuler: true,
      useInlineViewWhenSpaceIsLimited: false
    })
    editorRef.current = editor
    return () => {
      const model = editor.getModel()
      editor.dispose()
      model?.original.dispose()
      model?.modified.dispose()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    editorRef.current?.updateOptions({
      renderSideBySide: options.sideBySide,
      ignoreTrimWhitespace: options.ignoreWhitespace,
      hideUnchangedRegions: { enabled: options.hideUnchanged }
    })
  }, [options])

  // Trae las dos versiones del archivo directo de Git (o del disco), sin hacer checkout.
  const leftKey = sourceKey(left)
  const rightKey = sourceKey(right)
  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    const leftPath = change.oldPath ?? change.path
    Promise.all([
      change.status === 'added' ? MISSING : api.readFile(root, left, leftPath),
      change.status === 'deleted' ? MISSING : api.readFile(root, right, change.path)
    ]).then(
      ([leftContent, rightContent]) => !cancelled && setState({ status: 'ready', left: leftContent, right: rightContent }),
      (error: Error) => !cancelled && setState({ status: 'error', message: error.message })
    )
    return () => {
      cancelled = true
    }
    // left y right se usan a través de sus claves, para no recargar con objetos nuevos iguales.
  }, [root, leftKey, rightKey, change.path, change.oldPath, change.status, reloadKey])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || state.status !== 'ready') return
    const left = textOf(state.left)
    const right = textOf(state.right)
    if (left === null || right === null) return
    const language = languageFor(change.path)
    const previous = editor.getModel()
    editor.setModel({
      original: monaco.editor.createModel(left, language),
      modified: monaco.editor.createModel(right, language)
    })
    previous?.original.dispose()
    previous?.modified.dispose()
  }, [state, change.path])

  const message = blockingMessage(state)
  const identical =
    state.status === 'ready' && state.left.kind === 'text' && state.right.kind === 'text' && state.left.text === state.right.text
  const toggle = (key: keyof DiffOptions) => onOptionsChange({ ...options, [key]: !options[key] })

  return (
    <section className="diff">
      <header className="diff__header">
        <div className="diff__title">
          <StatusBadge status={change.status} />
          <span className="diff__path" title={change.path}>
            {change.oldPath ? (
              <>
                <span className="text-2">{change.oldPath}</span> → {change.path}
              </>
            ) : (
              change.path
            )}
          </span>
          {state.status === 'loading' && <span className="text-2 small">{t('Cargando…')}</span>}
        </div>
        <div className="diff__actions">
          <button className="btn btn--icon btn--ghost" aria-label={t('Cambio anterior')} title={t('Cambio anterior')} onClick={() => editorRef.current?.goToDiff('previous')}>
            <ChevronUp size={16} strokeWidth={1.75} />
          </button>
          <button className="btn btn--icon btn--ghost" aria-label={t('Cambio siguiente')} title={t('Cambio siguiente')} onClick={() => editorRef.current?.goToDiff('next')}>
            <ChevronDown size={16} strokeWidth={1.75} />
          </button>
          <span className="divider" />
          <Toggle label={t('Lado a lado')} checked={options.sideBySide} onChange={() => toggle('sideBySide')} />
          <Toggle label={t('Ignorar espacios')} checked={options.ignoreWhitespace} onChange={() => toggle('ignoreWhitespace')} />
          <Toggle label={t('Ocultar sin cambios')} checked={options.hideUnchanged} onChange={() => toggle('hideUnchanged')} />
        </div>
      </header>

      <div className={`diff__sides${options.sideBySide ? '' : ' diff__sides--inline'}`}>
        <span>
          <strong>A</strong> · {labelA}
          {change.status === 'added' && <em> {t('(no existe)')}</em>}
        </span>
        <span>
          <strong>B</strong> · {labelB}
          {change.status === 'deleted' && <em> {t('(no existe)')}</em>}
        </span>
      </div>

      {identical && (
        <div className="diff__notice">
          {t('El contenido es idéntico en las dos ramas')}
          {change.status === 'renamed' ? t(': solo cambió el nombre.') : t('; cambiaron solo los permisos o el tipo de archivo.')}
        </div>
      )}

      <div className="diff__body">
        <div ref={containerRef} className={`diff__editor${message ? ' diff__editor--hidden' : ''}`} />
        {message && <div className="diff__message">{message}</div>}
      </div>
    </section>
  )
}

/** Mensaje que reemplaza al editor cuando no hay texto para comparar. */
function blockingMessage(state: LoadState): string | null {
  // Mientras carga se deja ver el archivo anterior, para que no parpadee al moverse con el teclado.
  if (state.status === 'loading') return null
  if (state.status === 'error') return t('No se pudo leer el archivo: {message}', { message: state.message })
  for (const content of [state.left, state.right]) {
    if (content.kind === 'binary') return t('Es un archivo binario: no se puede mostrar la diferencia como texto.')
    if (content.kind === 'too-large') {
      return t('El archivo pesa {value} MB; por ahora el visor muestra archivos de hasta 5 MB.', { value: (content.size / 1024 / 1024).toFixed(1) })
    }
  }
  return null
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(): void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  )
}
