import { Archive, ArrowDown, ArrowUp, Check, ChevronRight, Cloud, Eye, EyeOff, Focus, Laptop, Search, Tag } from 'lucide-react'
import { useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import type { GraphFilter, RefInfo, RefList, StashInfo } from '../../../shared/types'
import { relativeDate } from '../lib/format'
import { splitRemoteName } from '../lib/refs'
import { loadSetting, saveSetting } from '../lib/settings'
import { REF_DRAG_TYPE, type MenuAnchor } from './CommitList'

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
  stashes: StashInfo[]
  filter: GraphFilter
  /** Rama cuyo linaje se está mostrando. */
  selectedRef: string | null
  /** Stash que se está mirando en el detalle. */
  selectedStash: string | null
  onSelectRef(ref: RefInfo): void
  onSelectStash(stash: StashInfo): void
  onRefMenu(ref: RefInfo, at: MenuAnchor): void
  onStashMenu(stash: StashInfo, at: MenuAnchor): void
  onRefDoubleClick(ref: RefInfo): void
  onRefDrop(source: string, target: RefInfo, at: MenuAnchor): void
  onToggleHidden(ref: RefInfo): void
}

/** Panel izquierdo del historial, como en GitKraken: ramas locales, remotas por remoto, tags y stashes. */
export function RefsPanel(props: Props) {
  const { refs, stashes, filter, selectedRef, selectedStash } = props
  const [query, setQuery] = useState('')
  // Las secciones cerradas se recuerdan (los tags suelen ser muchos y conviene tenerlos cerrados).
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set(loadSetting<string[]>('refsClosed', [])))
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const hidden = useMemo(() => new Set(filter.hidden), [filter.hidden])
  const solo = useMemo(() => new Set(filter.solo), [filter.solo])

  const sections = useMemo((): Section[] => {
    const q = query.trim().toLowerCase()
    const matching = refs.refs.filter((r) => !q || r.name.toLowerCase().includes(q)).sort((a, b) => collator.compare(a.name, b.name))

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
  }, [refs, query])

  const visibleStashes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stashes.filter((s) => !q || s.message.toLowerCase().includes(q))
  }, [stashes, query])

  const toggle = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveSetting('refsClosed', [...next])
      return next
    })

  const contextMenu = (ref: RefInfo) => (e: MouseEvent) => {
    e.preventDefault()
    props.onRefMenu(ref, e)
  }

  const dragHandlers = (ref: RefInfo) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(REF_DRAG_TYPE, ref.ref)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(REF_DRAG_TYPE)) return
      e.preventDefault()
      setDropTarget(ref.ref)
    },
    onDragLeave: () => setDropTarget((t) => (t === ref.ref ? null : t)),
    onDrop: (e: DragEvent) => {
      setDropTarget(null)
      const source = e.dataTransfer.getData(REF_DRAG_TYPE)
      if (!source || source === ref.ref) return
      e.preventDefault()
      props.onRefDrop(source, ref, e)
    }
  })

  return (
    <div className="refs-panel">
      <label className="field field--search refs-panel__filter">
        <Search size={14} strokeWidth={1.75} aria-hidden />
        <input type="search" placeholder="Filtrar ramas, tags y stashes" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="refs-panel__scroll">
        {sections.map((section) => {
          const open = !closed.has(section.id)
          return (
            <section key={section.id} className="refs-section">
              <SectionHeader id={section.id} title={section.title} Icon={section.Icon} count={section.refs.length} open={open} onToggle={toggle} />
              {open && (
                <ul>
                  {section.refs.length === 0 && <li className="refs-section__empty">Ninguna</li>}
                  {section.refs.map((ref) => {
                    const current = ref.ref === refs.current
                    const selected = ref.ref === selectedRef
                    const isHidden = hidden.has(ref.ref) || (solo.size > 0 && !solo.has(ref.ref))
                    const classes = [
                      'ref-item',
                      current && 'ref-item--current',
                      selected && 'ref-item--selected',
                      isHidden && 'ref-item--hidden',
                      dropTarget === ref.ref && 'ref-item--drop'
                    ]
                    return (
                      <li key={ref.ref} className="ref-row">
                        <button
                          className={classes.filter(Boolean).join(' ')}
                          title={refTitle(ref, current)}
                          aria-pressed={selected}
                          onClick={() => props.onSelectRef(ref)}
                          onDoubleClick={() => !current && props.onRefDoubleClick(ref)}
                          onContextMenu={contextMenu(ref)}
                          onKeyDown={(e) => {
                            if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
                              e.preventDefault()
                              props.onRefMenu(ref, e.currentTarget.getBoundingClientRect())
                            }
                          }}
                          {...dragHandlers(ref)}
                        >
                          <span className="ref-item__marker" aria-hidden>
                            {current && <Check size={13} strokeWidth={2.5} />}
                          </span>
                          <span className="ref-item__name">{section.display(ref)}</span>
                          <Tracking info={ref} />
                        </button>
                        <button
                          className={`ref-row__eye${isHidden ? ' ref-row__eye--on' : ''}`}
                          aria-label={isHidden ? `Mostrar ${ref.name} en el gráfico` : `Ocultar ${ref.name} en el gráfico`}
                          title={solo.has(ref.ref) ? 'Se muestra sola (clic derecho para cambiarlo)' : isHidden ? 'Oculta en el gráfico' : 'Ocultar en el gráfico'}
                          onClick={() => props.onToggleHidden(ref)}
                        >
                          {solo.has(ref.ref) ? (
                            <Focus size={13} strokeWidth={1.75} />
                          ) : isHidden ? (
                            <EyeOff size={13} strokeWidth={1.75} />
                          ) : (
                            <Eye size={13} strokeWidth={1.75} />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}

        <section className="refs-section">
          <SectionHeader id="stashes" title="Stashes" Icon={Archive} count={visibleStashes.length} open={!closed.has('stashes')} onToggle={toggle} />
          {!closed.has('stashes') && (
            <ul>
              {visibleStashes.length === 0 && <li className="refs-section__empty">Ninguno</li>}
              {visibleStashes.map((stash) => (
                <li key={stash.sha} className="ref-row">
                  <button
                    className={`ref-item ref-item--stash${stash.sha === selectedStash ? ' ref-item--selected' : ''}`}
                    title={`${stash.message}\nGuardado ${relativeDate(stash.date)} · clic derecho para aplicarlo o borrarlo`}
                    onClick={() => props.onSelectStash(stash)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      props.onStashMenu(stash, e)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
                        e.preventDefault()
                        props.onStashMenu(stash, e.currentTarget.getBoundingClientRect())
                      }
                    }}
                  >
                    <span className="ref-item__marker" aria-hidden />
                    <span className="ref-item__name">{stashLabel(stash.message)}</span>
                    <span className="ref-item__meta">{relativeDate(stash.date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function SectionHeader({
  id,
  title,
  Icon,
  count,
  open,
  onToggle
}: {
  id: string
  title: string
  Icon: typeof Laptop
  count: number
  open: boolean
  onToggle(id: string): void
}) {
  return (
    <button className="refs-section__header" onClick={() => onToggle(id)} aria-expanded={open}>
      <ChevronRight size={13} strokeWidth={2} className={`chevron${open ? ' chevron--open' : ''}`} aria-hidden />
      <Icon size={13} strokeWidth={1.75} aria-hidden />
      <span className="refs-section__title">{title}</span>
      <span className="refs-section__count">{count}</span>
    </button>
  )
}

/** Commits para subir (↑) y para bajar (↓) respecto de la remota que sigue la rama. */
function Tracking({ info: ref }: { info: RefInfo }) {
  if (ref.kind !== 'local' || !ref.upstream) return null
  if (ref.upstreamGone) return <span className="ref-item__meta" title="La rama remota que seguía se borró del servidor">sin remota</span>
  if (!ref.ahead && !ref.behind) return null
  return (
    <span className="tracking" aria-label={`${ref.ahead ?? 0} para subir, ${ref.behind ?? 0} para bajar`}>
      {(ref.ahead ?? 0) > 0 && (
        <span>
          <ArrowUp size={11} strokeWidth={2.25} aria-hidden />
          {ref.ahead}
        </span>
      )}
      {(ref.behind ?? 0) > 0 && (
        <span>
          <ArrowDown size={11} strokeWidth={2.25} aria-hidden />
          {ref.behind}
        </span>
      )}
    </span>
  )
}

function refTitle(ref: RefInfo, current: boolean): string {
  const lines = [current ? `${ref.name} (rama actual)` : ref.name]
  if (ref.upstream) lines.push(`Sigue a ${ref.upstream.replace(/^refs\/remotes\//, '')}`)
  lines.push(current ? 'Clic: ver de dónde sale · clic derecho: más opciones' : 'Clic: ver de dónde sale · doble clic: checkout · clic derecho: más opciones')
  return lines.join('\n')
}

/** "WIP on main: abc123 mensaje" u "On main: mensaje" → solo el mensaje. */
export function stashLabel(message: string): string {
  return message.replace(/^(WIP on|On) [^:]+:\s*/, '').replace(/^[0-9a-f]{7,40} /, '') || message
}
