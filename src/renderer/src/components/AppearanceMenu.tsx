import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ThemeChoice } from '../../../shared/types'
import { useAppearance } from '../lib/appearance'

const THEMES: { id: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { id: 'system', label: 'Sistema', Icon: Monitor },
  { id: 'light', label: 'Claro', Icon: Sun },
  { id: 'dark', label: 'Oscuro', Icon: Moon }
]

/** Botón de la barra de herramientas que abre las opciones de apariencia. */
export function AppearanceMenu() {
  const { appearance, update } = useAppearance()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggle = () => {
    const rect = buttonRef.current!.getBoundingClientRect()
    setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    setOpen((o) => !o)
  }

  // Se cierra con Esc o con un clic afuera.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        className={`btn btn--icon btn--ghost${open ? ' btn--pressed' : ''}`}
        aria-label="Apariencia"
        aria-expanded={open}
        title="Apariencia"
        onClick={toggle}
      >
        <Palette size={16} strokeWidth={1.75} />
      </button>
      {/* En un portal: la barra de herramientas tiene desenfoque y eso crea una capa propia que
          dejaría el menú debajo de los paneles. */}
      {open &&
        createPortal(
        <div ref={menuRef} className="menu glass" role="dialog" aria-label="Apariencia" style={{ top: position.top, right: position.right }}>
          <div className="menu__group">
            <span className="menu__label">Tema</span>
            <div className="segmented" role="radiogroup" aria-label="Tema">
              {THEMES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={appearance.theme === id}
                  className={`segmented__item${appearance.theme === id ? ' segmented__item--active' : ''}`}
                  onClick={() => update({ theme: id })}
                >
                  <Icon size={14} strokeWidth={1.75} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Switch
            label="Efecto vidrio"
            description="Paneles translúcidos con desenfoque."
            checked={appearance.glass}
            onChange={(glass) => update({ glass })}
          />
          <Switch
            label="Fotos de los autores"
            description="Desde GitHub o Gravatar. Apagado, no se hace ningún pedido a internet."
            checked={appearance.avatars}
            onChange={(avatars) => update({ avatars })}
          />
        </div>,
          document.body
        )}
    </>
  )
}

function Switch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <button className="switch-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="switch-row__text">
        <span className="switch-row__label">{label}</span>
        <span className="switch-row__description">{description}</span>
      </span>
      <span className={`switch${checked ? ' switch--on' : ''}`} aria-hidden>
        <span className="switch__thumb" />
      </span>
    </button>
  )
}
