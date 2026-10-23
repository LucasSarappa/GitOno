import { Check, ChevronRight, Cloud, Laptop, Search, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { RefInfo, RefList } from '../../../shared/types'
import { splitRemoteName } from '../lib/refs'

interface Section {
  id: string
  title: string
  Icon: typeof Laptop
  refs: RefInfo[]
  /** Texto a mostrar por cada referencia (en remotas, sin el nombre del remoto). */
  display(ref: RefInfo): string
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

interface Props {
  refs: RefList
  /** Rama cuyo linaje se está mostrando. */
  selectedRef: string | null
  onSelectRef(ref: RefInfo): void
}

/** Panel izquierdo del historial, como en GitKraken: ramas locales, remotas por remoto y tags. */
export function RefsPanel({ refs, selectedRef, onSelectRef }: Props) {
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
      { id: 'local', title: 'Locales', Icon: Laptop, refs: matching.filter((r) => r.kind === 'local'), display: (r) => r.name },
      ...[...remotes].map(([remote, list]) => ({
        id: `remote:${remote}`,
        title: remote,
        Icon: Cloud,
        refs: list,
        display: (r: RefInfo) => splitRemoteName(r.name).branch
      })),
      { id: 'tags', title: 'Tags', Icon: Tag, refs: matching.filter((r) => r.kind === 'tag'), display: (r) => r.name }
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
    <aside className="panel glass refs-panel" aria-label="Ramas y tags">
      <label className="field field--search refs-panel__filter">
        <Search size={14} strokeWidth={1.75} aria-hidden />
        <input type="search" placeholder="Filtrar ramas y tags" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      <div className="refs-panel__scroll">
        {sections.map((section) => {
          const open = !closed.has(section.id)
          return (
            <section key={section.id} className="refs-section">
              <button className="refs-section__header" onClick={() => toggle(section.id)} aria-expanded={open}>
                <ChevronRight size={13} strokeWidth={2} className={`chevron${open ? ' chevron--open' : ''}`} aria-hidden />
                <section.Icon size={13} strokeWidth={1.75} aria-hidden />
                <span className="refs-section__title">{section.title}</span>
                <span className="refs-section__count">{section.refs.length}</span>
              </button>
              {open && (
                <ul>
                  {section.refs.length === 0 && <li className="refs-section__empty">Ninguna</li>}
                  {section.refs.map((ref) => {
                    const current = ref.ref === refs.current
                    const selected = ref.ref === selectedRef
                    return (
                      <li key={ref.ref}>
                        <button
                          className={`ref-item${current ? ' ref-item--current' : ''}${selected ? ' ref-item--selected' : ''}`}
                          title={current ? `${ref.name} (rama actual) · ver de dónde sale` : `${ref.name} · ver de dónde sale`}
                          aria-pressed={selected}
                          onClick={() => onSelectRef(ref)}
                        >
                          <span className="ref-item__marker" aria-hidden>
                            {current && <Check size={13} strokeWidth={2.5} />}
                          </span>
                          <span className="ref-item__name">{section.display(ref)}</span>
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
