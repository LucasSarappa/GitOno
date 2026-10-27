import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { fuzzyFilter } from '../lib/fuzzy'
import { t } from '../../../shared/i18n'

type Icon = typeof Search

export interface Command {
  id: string
  /** Grupo que se muestra a la izquierda ("Rama", "Tema", "Vista"…); también se busca. */
  group: string
  label: string
  icon?: Icon
  /** Atajo de teclado, solo informativo. */
  hint?: string
  run(): void
}

/** Cuántos resultados se dibujan a la vez (la lista puede tener cientos de ramas). */
const LIMIT = 60

/**
 * Paleta de comandos (Ctrl+P), como en GitKraken y VS Code: todo lo que se puede hacer, buscable
 * escribiendo unas letras.
 */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose(): void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => fuzzyFilter(commands, query, (c) => `${c.group} ${c.label}`).slice(0, LIMIT), [commands, query])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (command: Command | undefined) => {
    if (!command) return
    onClose()
    command.run()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((a) => Math.min(results.length - 1, a + 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
    else if (e.key === 'Enter') run(results[active])
    else if (e.key === 'Escape') onClose()
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  return createPortal(
    <div className="palette-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette glass" role="dialog" aria-label={t('Paleta de comandos')} onKeyDown={onKeyDown}>
        <label className="palette__input">
          <Search size={16} strokeWidth={1.75} aria-hidden />
          <input
            autoFocus
            value={query}
            placeholder={t('Escribí un comando o el nombre de una rama…')}
            onChange={(e) => setQuery(e.target.value)}
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
          />
        </label>
        <div className="palette__list" id="palette-list" role="listbox" ref={listRef}>
          {results.length === 0 && <div className="palette__empty">{t('Ningún comando coincide con "{query}".', { query })}</div>}
          {results.map((command, index) => {
            const Icon = command.icon
            return (
              <div
                key={command.id}
                id={`cmd-${command.id}`}
                role="option"
                aria-selected={index === active}
                className={`palette__item${index === active ? ' palette__item--active' : ''}`}
                onPointerMove={() => setActive(index)}
                onClick={() => run(command)}
              >
                <span className="palette__icon" aria-hidden>
                  {Icon && <Icon size={14} strokeWidth={1.75} />}
                </span>
                <span className="palette__group">{command.group}</span>
                <span className="palette__label">{command.label}</span>
                {command.hint && <kbd className="palette__hint">{command.hint}</kbd>}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
