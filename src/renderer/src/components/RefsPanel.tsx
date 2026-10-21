import { useMemo, useState } from 'react'
import type { RefInfo, RefList } from '../../../shared/types'
import { splitRemoteName } from '../lib/refs'

interface Section {
  id: string
  title: string
  refs: RefInfo[]
  /** Texto a mostrar por cada referencia (en remotas, sin el nombre del remoto). */
  display(ref: RefInfo): string
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

interface Props {
  refs: RefList
  onSelectRef(ref: RefInfo): void
}

/** Panel izquierdo del historial: ramas locales, remotas agrupadas por remoto y tags. */
export function RefsPanel({ refs, onSelectRef }: Props) {
  const [filter, setFilter] = useState('')
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())

  const sections = useMemo((): Section[] => {
    const query = filter.trim().toLowerCase()
    const matching = refs.refs
      .filter((r) => !query || r.name.toLowerCase().includes(query))
      .sort((a, b) => collator.compare(a.name, b.name))

    const remotes = new Map<string, RefInfo[]>()
    for (const ref of matching.filter((r) => r.kind === 'remote')) {
      const { remote } = splitRemoteName(ref.name)
      remotes.set(remote, [...(remotes.get(remote) ?? []), ref])
    }

    return [
      { id: 'local', title: 'Ramas locales', refs: matching.filter((r) => r.kind === 'local'), display: (r) => r.name },
      ...[...remotes].map(([remote, list]) => ({
        id: `remote:${remote}`,
        title: `Remoto: ${remote}`,
        refs: list,
        display: (r: RefInfo) => splitRemoteName(r.name).branch
      })),
      { id: 'tags', title: 'Tags', refs: matching.filter((r) => r.kind === 'tag'), display: (r) => r.name }
    ]
  }, [refs, filter])

  const toggle = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <aside className="refs-panel" aria-label="Ramas y tags">
      <input
        className="filter"
        type="search"
        placeholder="Filtrar ramas y tags…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="refs-panel__scroll">
        {sections.map((section) => {
          const open = !closed.has(section.id)
          return (
            <section key={section.id}>
              <button className="refs-panel__section" onClick={() => toggle(section.id)} aria-expanded={open}>
                <span className={`tree__chevron${open ? ' tree__chevron--open' : ''}`} aria-hidden>
                  ›
                </span>
                <span className="refs-panel__title">{section.title}</span>
                <span className="refs-panel__count">{section.refs.length}</span>
              </button>
              {open && (
                <ul>
                  {section.refs.length === 0 && <li className="refs-panel__empty muted small">Ninguna</li>}
                  {section.refs.map((ref) => {
                    const current = ref.ref === refs.current
                    return (
                      <li key={ref.ref}>
                        <button
                          className={`refs-panel__item${current ? ' refs-panel__item--current' : ''}`}
                          title={current ? `${ref.name} (rama actual)` : ref.name}
                          onClick={() => onSelectRef(ref)}
                        >
                          <span className="refs-panel__marker" aria-hidden>
                            {current ? '✓' : section.id === 'tags' ? '◆' : ''}
                          </span>
                          <span className="refs-panel__name">{section.display(ref)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
