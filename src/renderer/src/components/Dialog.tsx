import { X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { t } from '../../../shared/i18n'

export type DialogValues = Record<string, string | boolean>

export interface DialogField {
  name: string
  label: string
  kind?: 'text' | 'textarea' | 'checkbox' | 'select'
  value?: string | boolean
  placeholder?: string
  /** Texto de ayuda debajo del campo. */
  hint?: string
  required?: boolean
  options?: { value: string; label: string }[]
  /** Letra monoespaciada (nombres de ramas, SHA). */
  mono?: boolean
  /** Solo se muestra si otro campo (un checkbox) está marcado. */
  showIf?: string
}

export interface DialogOptions {
  title: string
  description?: ReactNode
  fields?: DialogField[]
  confirmLabel: string
  danger?: boolean
  /** Se ejecuta al confirmar. Si falla, el error se muestra en el diálogo y queda abierto. */
  onSubmit?(values: DialogValues): Promise<void> | void
}

interface DialogApi {
  /** Muestra el diálogo. Devuelve true si se confirmó (y onSubmit terminó bien). */
  show(options: DialogOptions): Promise<boolean>
}

const Context = createContext<DialogApi>({ show: async () => false })

export const useDialog = () => useContext(Context)

interface Pending {
  options: DialogOptions
  resolve(confirmed: boolean): void
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const show = useCallback(
    (options: DialogOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve })
      }),
    []
  )
  const api = useMemo(() => ({ show }), [show])
  const finish = (confirmed: boolean) => {
    pending?.resolve(confirmed)
    setPending(null)
  }
  return (
    <Context.Provider value={api}>
      {children}
      {pending && createPortal(<DialogBox options={pending.options} onDone={finish} />, document.body)}
    </Context.Provider>
  )
}

function DialogBox({ options, onDone }: { options: DialogOptions; onDone(confirmed: boolean): void }) {
  const fields = options.fields ?? []
  const [values, setValues] = useState<DialogValues>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.value ?? (f.kind === 'checkbox' ? false : '')]))
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const boxRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const first = boxRef.current?.querySelector<HTMLElement>('input:not([type=checkbox]), textarea, select') ?? boxRef.current?.querySelector<HTMLElement>('.dialog__confirm')
    first?.focus()
    if (first instanceof HTMLInputElement) first.select()
  }, [])

  const visible = fields.filter((f) => !f.showIf || values[f.showIf] === true)
  const missing = visible.some((f) => f.required && typeof values[f.name] === 'string' && !(values[f.name] as string).trim())

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy || missing) return
    setBusy(true)
    setError(null)
    try {
      await options.onSubmit?.(values)
      onDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !busy) {
      e.stopPropagation()
      onDone(false)
    }
    // En un texto largo, Enter es salto de línea; Ctrl+Enter confirma.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit()
  }

  return (
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && !busy && onDone(false)}>
      <form
        ref={boxRef}
        className="dialog glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onSubmit={submit}
        onKeyDown={onKeyDown}
      >
        <header className="dialog__header">
          <h2 id="dialog-title">{options.title}</h2>
          <button type="button" className="btn btn--icon btn--ghost" aria-label={t('Cerrar')} onClick={() => onDone(false)} disabled={busy}>
            <X size={15} strokeWidth={1.75} />
          </button>
        </header>
        {options.description && <div className="dialog__description">{options.description}</div>}
        {visible.map((field) => (
          <FieldInput key={field.name} field={field} value={values[field.name]} onChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v }))} />
        ))}
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog__actions">
          <button type="button" className="btn" onClick={() => onDone(false)} disabled={busy}>
            {t('Cancelar')}
          </button>
          <button type="submit" className={`btn dialog__confirm ${options.danger ? 'btn--danger' : 'btn--primary'}`} disabled={busy || missing}>
            {busy ? t('Un momento…') : options.confirmLabel}
          </button>
        </footer>
      </form>
    </div>
  )
}

function FieldInput({ field, value, onChange }: { field: DialogField; value: string | boolean; onChange(value: string | boolean): void }) {
  const id = `dialog-field-${field.name}`
  if (field.kind === 'checkbox') {
    return (
      <label className="dialog__check">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>
          {field.label}
          {field.hint && <span className="dialog__hint">{field.hint}</span>}
        </span>
      </label>
    )
  }
  return (
    <div className="dialog__field">
      <label htmlFor={id}>{field.label}</label>
      {field.kind === 'textarea' ? (
        <textarea id={id} className="field" rows={4} placeholder={field.placeholder} value={String(value)} onChange={(e) => onChange(e.target.value)} />
      ) : field.kind === 'select' ? (
        <select id={id} className="field" value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className={`field${field.mono ? ' field--mono' : ''}`}
          placeholder={field.placeholder}
          value={String(value)}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.hint && <span className="dialog__hint">{field.hint}</span>}
    </div>
  )
}
