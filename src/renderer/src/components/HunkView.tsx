import { CircleSlash } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { wholeHunk, type FileDiff, type LineSelection } from '../../../shared/patch'
import type { PatchAction, WorkingArea } from '../../../shared/types'
import { t, tn } from '../../../shared/i18n'

interface Props {
  diff: FileDiff
  /** Sin preparar: se puede preparar o descartar. Preparado: se puede quitar del índice. */
  area: WorkingArea
  busy: boolean
  onAction(action: PatchAction, selection: LineSelection, lineCount: number | null): void
}

const key = (hunk: number, line: number) => `${hunk}:${line}`

/**
 * Diff de un archivo con cambios locales, por bloques. Cada bloque tiene sus botones; si se
 * eligen líneas (clic, o Shift+clic para un rango) los botones actúan solo sobre esas líneas.
 */
export function HunkView({ diff, area, busy, onAction }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [anchor, setAnchor] = useState<{ hunk: number; line: number } | null>(null)

  // Con un diff nuevo (después de preparar algo, o si el archivo cambió) la selección ya no vale.
  useEffect(() => {
    setSelected(new Set())
    setAnchor(null)
  }, [diff])

  const toggleLine = (hunk: number, line: number, e: MouseEvent) => {
    // Arrastrar para seleccionar texto (y copiarlo) no elige líneas.
    if (window.getSelection()?.toString()) return
    const next = new Set(selected)
    if (e.shiftKey && anchor && anchor.hunk === hunk) {
      const [from, to] = anchor.line < line ? [anchor.line, line] : [line, anchor.line]
      for (let l = from; l <= to; l++) if (diff.hunks[hunk].lines[l].kind !== 'context') next.add(key(hunk, l))
    } else {
      if (next.has(key(hunk, line))) next.delete(key(hunk, line))
      else next.add(key(hunk, line))
      setAnchor({ hunk, line })
    }
    setSelected(next)
  }

  const act = (action: PatchAction, hunk: number) => {
    const count = diff.hunks[hunk].lines.filter((_, l) => selected.has(key(hunk, l))).length
    const selection: LineSelection = count > 0 ? (h, l) => h === hunk && selected.has(key(h, l)) : wholeHunk(hunk)
    onAction(action, selection, count > 0 ? count : null)
  }

  return (
    <div className="hunks">
      <p className="hunks__hint text-2 small">
        {t('Clic en una línea agregada o borrada para elegirla (Shift+clic elige un rango). Los botones de cada bloque actúan sobre las líneas elegidas, o sobre el bloque entero si no elegiste ninguna.')}
      </p>
      {diff.hunks.map((hunk, h) => {
        const count = hunk.lines.filter((_, l) => selected.has(key(h, l))).length
        return (
          <section key={hunk.header + h} className="hunk">
            <header className="hunk__header">
              <code className="hunk__range" title={hunk.header}>
                {hunk.header}
              </code>
              <div className="hunk__actions">
                {area === 'unstaged' ? (
                  <>
                    <button className="btn btn--sm" disabled={busy} onClick={() => act('discard', h)}>
                      {count > 0 ? tn(count, 'Descartar {n} línea', 'Descartar {n} líneas') : t('Descartar bloque')}
                    </button>
                    <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => act('stage', h)}>
                      {count > 0 ? tn(count, 'Preparar {n} línea', 'Preparar {n} líneas') : t('Preparar bloque')}
                    </button>
                  </>
                ) : (
                  <button className="btn btn--sm" disabled={busy} onClick={() => act('unstage', h)}>
                    {count > 0 ? tn(count, 'Quitar {n} línea', 'Quitar {n} líneas') : t('Quitar bloque')}
                  </button>
                )}
              </div>
            </header>
            <div className="hunk__lines" role="list">
              {hunk.lines.map((line, l) => {
                const isChange = line.kind !== 'context'
                const isSelected = selected.has(key(h, l))
                return (
                  <div
                    key={l}
                    role="listitem"
                    className={`hunk-line hunk-line--${line.kind}${isSelected ? ' hunk-line--selected' : ''}`}
                    onClick={isChange ? (e) => toggleLine(h, l, e) : undefined}
                    aria-selected={isChange ? isSelected : undefined}
                  >
                    <span className="hunk-line__number">{line.oldNumber ?? ''}</span>
                    <span className="hunk-line__number">{line.newNumber ?? ''}</span>
                    <span className="hunk-line__sign">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ''}</span>
                    <span className="hunk-line__text">{line.text.replace(/\r$/, '')}</span>
                    {line.noNewline && (
                      <span className="hunk-line__eol" title={t('Sin salto de línea al final del archivo')}>
                        <CircleSlash size={11} strokeWidth={2} aria-label={t('Sin salto de línea al final')} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
