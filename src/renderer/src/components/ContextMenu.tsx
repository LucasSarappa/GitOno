import { Check, ChevronRight } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'

type Icon = typeof Check

export type MenuItem =
  | {
      kind?: 'item'
      label: string
      icon?: Icon
      /** Atajo de teclado a mostrar a la derecha (solo informativo). */
      hint?: string
      danger?: boolean
      disabled?: boolean
      onSelect(): void
    }
  | { kind: 'check'; label: string; checked: boolean; disabled?: boolean; onSelect(): void }
  | { kind: 'submenu'; label: string; icon?: Icon; disabled?: boolean; items: MenuItem[] }
  | { kind: 'separator' }
  | { kind: 'label'; label: string }

/** Un ítem, o algo falso cuando no corresponde mostrarlo (`condición && {...}`). */
export type MenuEntry = MenuItem | false | null | undefined | ''

/**
 * Quita lo que no corresponde y los separadores que sobran: al principio, al final, repetidos o
 * pegados al título. Pasa cuando una sección del menú queda vacía.
 */
export function tidy(items: MenuEntry[]): MenuItem[] {
  const result: MenuItem[] = []
  for (const item of items) {
    if (!item) continue
    if (item.kind === 'separator') {
      const last = result.at(-1)
      if (!last || last.kind === 'separator' || last.kind === 'label') continue
    }
    result.push(item)
  }
  while (result.at(-1)?.kind === 'separator') result.pop()
  return result
}

interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

interface ContextMenuApi {
  /** Abre el menú en la posición del mouse (o de un elemento, si se abrió con el teclado). */
  open(at: { clientX: number; clientY: number } | DOMRect, items: MenuItem[]): void
  close(): void
}

const Context = createContext<ContextMenuApi>({ open: () => undefined, close: () => undefined })

export const useContextMenu = () => useContext(Context)

/** Menú contextual propio: con el estilo de la app, submenús y manejo con el teclado. */
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MenuState | null>(null)
  const close = useCallback(() => setState(null), [])
  const open = useCallback<ContextMenuApi['open']>((at, items) => {
    const point = 'clientX' in at ? { x: at.clientX, y: at.clientY } : { x: at.left, y: at.bottom + 4 }
    // Sin nada que mostrar no se abre un menú vacío.
    if (items.some((i) => i.kind !== 'separator' && i.kind !== 'label')) setState({ ...point, items })
  }, [])
  const api = useMemo(() => ({ open, close }), [open, close])

  return (
    <Context.Provider value={api}>
      {children}
      {state && createPortal(<MenuLayer state={state} onClose={close} />, document.body)}
    </Context.Provider>
  )
}

function MenuLayer({ state, onClose }: { state: MenuState; onClose(): void }) {
  const layerRef = useRef<HTMLDivElement>(null)

  // Se cierra con un clic afuera, al cambiar de ventana o al hacer scroll en otro lado.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!layerRef.current?.contains(e.target as Node)) onClose()
    }
    const onScroll = (e: Event) => {
      if (!layerRef.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  return (
    <div ref={layerRef}>
      <MenuList items={state.items} x={state.x} y={state.y} depth={0} onClose={onClose} autoFocus />
    </div>
  )
}

const selectable = (item: MenuItem) => item.kind !== 'separator' && item.kind !== 'label' && !item.disabled

interface ListProps {
  items: MenuItem[]
  x: number
  y: number
  depth: number
  onClose(): void
  /** Al cerrar un submenú con ← o Esc, el foco vuelve al ítem que lo abrió. */
  onBack?(): void
  autoFocus?: boolean
  /** Si no entra a la derecha, el submenú se abre hacia la izquierda de su ítem. */
  flipFrom?: number
}

function MenuList({ items, x, y, depth, onClose, onBack, autoFocus, flipFrom }: ListProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y, ready: false })
  const [active, setActive] = useState(-1)
  const [openSub, setOpenSub] = useState<{ index: number; rect: DOMRect; focus: boolean } | null>(null)
  const hoverTimer = useRef<number>(0)

  // Se acomoda para que no se salga de la ventana.
  useLayoutEffect(() => {
    const menu = ref.current!
    const { width, height } = menu.getBoundingClientRect()
    const margin = 8
    let left = x
    if (left + width > window.innerWidth - margin) left = flipFrom !== undefined ? flipFrom - width : window.innerWidth - margin - width
    let top = y
    if (top + height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - margin - height)
    setPosition({ left: Math.max(margin, left), top, ready: true })
  }, [x, y, flipFrom])

  useEffect(() => {
    if (autoFocus && position.ready) ref.current?.focus()
  }, [autoFocus, position.ready])

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const openSubmenu = (index: number, focus: boolean) => {
    const rect = itemRefs.current[index]?.getBoundingClientRect()
    if (rect) setOpenSub({ index, rect, focus })
  }

  const activate = (index: number) => {
    const item = items[index]
    if (!item || !selectable(item)) return
    if (item.kind === 'submenu') {
      openSubmenu(index, true)
      return
    }
    if (item.kind === 'separator' || item.kind === 'label') return
    onClose()
    item.onSelect()
  }

  const move = (step: 1 | -1) => {
    const count = items.length
    for (let i = 1; i <= count; i++) {
      const next = (active + step * i + count * 2) % count
      if (selectable(items[next])) {
        setActive(next)
        itemRefs.current[next]?.focus()
        return
      }
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (openSub?.focus) return
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Home: () => {
        setActive(-1)
        move(1)
      },
      Enter: () => activate(active),
      ' ': () => activate(active),
      ArrowRight: () => items[active]?.kind === 'submenu' && activate(active),
      ArrowLeft: () => onBack?.(),
      Escape: () => (onBack ? onBack() : onClose()),
      Tab: () => onClose()
    }
    const handler = keys[e.key]
    if (!handler) return
    e.preventDefault()
    e.stopPropagation()
    handler()
  }

  return (
    <>
      <div
        ref={ref}
        className="context-menu glass"
        role="menu"
        tabIndex={-1}
        style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden', zIndex: 60 + depth }}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item, index) => {
          if (item.kind === 'separator') return <div key={index} className="context-menu__separator" role="separator" />
          if (item.kind === 'label') {
            return (
              <div key={index} className="context-menu__label">
                {item.label}
              </div>
            )
          }
          const Icon = item.kind === 'check' ? null : item.icon
          const classes = [
            'context-menu__item',
            index === active && 'context-menu__item--active',
            item.kind !== 'check' && item.kind !== 'submenu' && item.danger && 'context-menu__item--danger',
            openSub?.index === index && 'context-menu__item--open'
          ]
          return (
            <button
              key={index}
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              className={classes.filter(Boolean).join(' ')}
              role={item.kind === 'check' ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={item.kind === 'check' ? item.checked : undefined}
              aria-haspopup={item.kind === 'submenu' ? 'menu' : undefined}
              aria-expanded={item.kind === 'submenu' ? openSub?.index === index : undefined}
              disabled={item.disabled}
              tabIndex={-1}
              onPointerEnter={() => {
                setActive(index)
                window.clearTimeout(hoverTimer.current)
                if (item.kind === 'submenu') hoverTimer.current = window.setTimeout(() => openSubmenu(index, false), 120)
                else if (openSub) hoverTimer.current = window.setTimeout(() => setOpenSub(null), 200)
              }}
              onClick={() => activate(index)}
            >
              <span className="context-menu__icon" aria-hidden>
                {item.kind === 'check' ? item.checked && <Check size={14} strokeWidth={2.25} /> : Icon && <Icon size={14} strokeWidth={1.75} />}
              </span>
              <span className="context-menu__text">{item.label}</span>
              {item.kind === 'submenu' ? (
                <ChevronRight size={13} strokeWidth={2} className="context-menu__chevron" aria-hidden />
              ) : (
                item.kind !== 'check' && item.hint && <kbd className="context-menu__hint">{item.hint}</kbd>
              )}
            </button>
          )
        })}
      </div>
      {openSub && items[openSub.index]?.kind === 'submenu' && (
        <MenuList
          key={openSub.index}
          items={(items[openSub.index] as Extract<MenuItem, { kind: 'submenu' }>).items}
          x={openSub.rect.right + 2}
          y={openSub.rect.top - 5}
          flipFrom={openSub.rect.left - 2}
          depth={depth + 1}
          onClose={onClose}
          autoFocus={openSub.focus}
          onBack={() => {
            const index = openSub.index
            setOpenSub(null)
            itemRefs.current[index]?.focus()
            ref.current?.focus()
            setActive(index)
          }}
        />
      )}
    </>
  )
}
