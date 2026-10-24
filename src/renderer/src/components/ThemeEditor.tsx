import { ClipboardPaste, Copy, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAppearance } from '../lib/appearance'
import { COLOR_GROUPS, contrastProblems, exportTheme, importTheme, normalizeHex, type ColorKey } from '../lib/themes'
import { useDialog } from './Dialog'

/**
 * Panel lateral para cambiar los colores del tema activo. No bloquea la app: los cambios se ven
 * en vivo detrás. Cada color se puede volver al original, y el tema se copia y se pega como texto.
 */
export function ThemeEditor({ onClose }: { onClose(): void }) {
  const { appearance, palette, colors, setColor, setCustom, choosePalette } = useAppearance()
  const dialog = useDialog()
  const [copied, setCopied] = useState(false)
  const custom = appearance.custom[palette.id] ?? {}
  const changed = Object.keys(custom).length
  const problems = contrastProblems(colors)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.key === 'Escape' && !target?.closest('.dialog')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copyTheme = () =>
    void api.copyText(exportTheme(palette, colors)).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })

  const pasteTheme = () =>
    void dialog.show({
      title: 'Pegar un tema',
      description: 'Pegá el texto de un tema copiado desde GitOno (con "Copiar el tema").',
      fields: [{ name: 'json', label: 'Tema', kind: 'textarea', required: true, mono: true }],
      confirmLabel: 'Usar este tema',
      onSubmit: (values) => {
        const result = importTheme(String(values.json))
        if ('error' in result) throw new Error(result.error)
        choosePalette(result.base.id)
        setCustom(result.base.id, result.overrides)
      }
    })

  return (
    <aside className="theme-editor glass" aria-label={`Colores de ${palette.name}`}>
      <header className="theme-editor__header">
        <div>
          <h2>Colores de {palette.name}</h2>
          <p>{changed === 0 ? 'Los colores originales del tema.' : `${changed === 1 ? '1 color cambiado' : `${changed} colores cambiados`}.`}</p>
        </div>
        <button className="btn btn--icon btn--ghost" aria-label="Cerrar" onClick={onClose}>
          <X size={15} strokeWidth={1.75} />
        </button>
      </header>

      {problems.length > 0 && (
        <div className="theme-editor__warning" role="status">
          <TriangleAlert size={14} strokeWidth={1.75} aria-hidden />
          <div>
            Algunos textos van a costar leerse:
            <ul>
              {problems.map((p) => (
                <li key={p.label}>
                  {p.label}: {p.ratio.toFixed(1).replace('.', ',')}:1 (mínimo {String(p.min).replace('.', ',')}:1)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="theme-editor__scroll">
        {COLOR_GROUPS.map((group) => (
          <section key={group.title} className="theme-editor__group">
            <h3>{group.title}</h3>
            {group.keys.map(({ key, label }) => (
              <ColorRow
                key={key}
                label={label}
                value={colors[key]}
                original={palette.colors[key]}
                changed={key in custom}
                onChange={(value) => setColor(key, value)}
                onReset={() => setColor(key as ColorKey, null)}
              />
            ))}
          </section>
        ))}
      </div>

      <footer className="theme-editor__footer">
        <button className="btn btn--sm" disabled={changed === 0} onClick={() => setCustom(palette.id, {})}>
          <RotateCcw size={13} strokeWidth={1.75} aria-hidden />
          Volver a los originales
        </button>
        <span className="theme-editor__spacer" />
        <button className="btn btn--sm" onClick={copyTheme} title="Copia el tema como texto, para guardarlo o compartirlo">
          <Copy size={13} strokeWidth={1.75} aria-hidden />
          {copied ? 'Copiado' : 'Copiar el tema'}
        </button>
        <button className="btn btn--sm" onClick={pasteTheme}>
          <ClipboardPaste size={13} strokeWidth={1.75} aria-hidden />
          Pegar…
        </button>
      </footer>
    </aside>
  )
}

function ColorRow({
  label,
  value,
  original,
  changed,
  onChange,
  onReset
}: {
  label: string
  value: string
  original: string
  changed: boolean
  onChange(value: string): void
  onReset(): void
}) {
  // El texto se edita libre y se aplica cuando es un color válido.
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const valid = normalizeHex(text) !== null

  return (
    <div className="color-row">
      <label className="color-row__swatch" title="Elegir el color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      </label>
      <span className="color-row__label">{label}</span>
      <input
        className={`field field--mono color-row__hex${valid ? '' : ' color-row__hex--invalid'}`}
        value={text}
        spellCheck={false}
        maxLength={7}
        aria-label={`${label} en hexadecimal`}
        onChange={(e) => {
          setText(e.target.value)
          const hex = normalizeHex(e.target.value)
          if (hex) onChange(hex)
        }}
        onBlur={() => setText(value)}
      />
      <button
        className="btn btn--icon btn--ghost btn--sm color-row__reset"
        aria-label={`Volver al original (${original})`}
        title={`Volver al original (${original})`}
        disabled={!changed}
        onClick={onReset}
      >
        <RotateCcw size={12} strokeWidth={1.75} />
      </button>
    </div>
  )
}
