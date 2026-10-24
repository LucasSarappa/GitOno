import { Check, Minus, Monitor, Moon, Palette as PaletteIcon, Pipette, Plus, Sun } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { ThemeChoice } from '../../../shared/types'
import { useAppearance } from '../lib/appearance'
import { PALETTES, resolveColors, type Palette } from '../lib/themes'
import { ThemeEditor } from './ThemeEditor'

const MODES: { id: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { id: 'system', label: 'Sistema', Icon: Monitor },
  { id: 'light', label: 'Claro', Icon: Sun },
  { id: 'dark', label: 'Oscuro', Icon: Moon }
]

/** Botón de la barra de herramientas que abre las opciones de apariencia. */
export function AppearanceMenu() {
  const { appearance, palette, update, choosePalette, zoomBy } = useAppearance()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
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

  const group = (kind: Palette['kind']) => PALETTES.filter((p) => p.kind === kind)
  const chosen = (p: Palette) => (p.kind === 'dark' ? appearance.darkPalette : appearance.lightPalette) === p.id

  return (
    <>
      <button
        ref={buttonRef}
        className={`btn btn--icon btn--ghost${open ? ' btn--pressed' : ''}`}
        aria-label="Apariencia"
        aria-expanded={open}
        title="Apariencia: temas, colores y zoom"
        onClick={toggle}
      >
        <PaletteIcon size={16} strokeWidth={1.75} />
      </button>
      {/* En un portal: la barra de herramientas puede tener desenfoque, y eso crea una capa propia
          que dejaría el menú debajo de los paneles. */}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="menu menu--appearance glass"
            role="dialog"
            aria-label="Apariencia"
            style={{ top: position.top, right: position.right, maxHeight: `calc(100vh - ${position.top + 12}px)` }}
          >
            <div className="menu__group">
              <span className="menu__label">Modo</span>
              <div className="segmented" role="radiogroup" aria-label="Modo">
                {MODES.map(({ id, label, Icon }) => (
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

            {(['dark', 'light'] as const).map((kind) => (
              <div className="menu__group" key={kind}>
                <span className="menu__label">{kind === 'dark' ? 'Temas oscuros' : 'Temas claros'}</span>
                <div className="theme-grid" role="radiogroup" aria-label={kind === 'dark' ? 'Temas oscuros' : 'Temas claros'}>
                  {group(kind).map((p) => (
                    <ThemeCard
                      key={p.id}
                      palette={p}
                      custom={appearance.custom[p.id]}
                      chosen={chosen(p)}
                      active={p.id === palette.id}
                      onChoose={() => choosePalette(p.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

            <button
              className="btn menu__wide"
              onClick={() => {
                setOpen(false)
                setEditing(true)
              }}
            >
              <Pipette size={14} strokeWidth={1.75} aria-hidden />
              Personalizar los colores de {palette.name}…
            </button>

            <div className="menu__separator" />

            <Switch
              label="Paneles flotantes con vidrio"
              description="Translúcidos y separados. Apagado, van pegados como en GitKraken."
              checked={appearance.glass}
              onChange={(glass) => update({ glass })}
            />
            <Switch
              label="Fotos de los autores"
              description="Desde GitHub o Gravatar. Apagado, no se hace ningún pedido a internet."
              checked={appearance.avatars}
              onChange={(avatars) => update({ avatars })}
            />
            <Switch
              label="Foto del autor en el gráfico"
              description="Cada commit se dibuja con la foto (o las iniciales) de su autor."
              checked={appearance.graphAvatars}
              onChange={(graphAvatars) => update({ graphAvatars })}
            />

            <div className="menu__row">
              <span className="menu__label">Zoom</span>
              <div className="zoom-control">
                <button className="btn btn--icon btn--sm" aria-label="Achicar (Ctrl −)" title="Achicar (Ctrl −)" onClick={() => zoomBy(-1)}>
                  <Minus size={13} strokeWidth={2} />
                </button>
                <button className="zoom-control__value" title="Volver a 100 % (Ctrl 0)" onClick={() => zoomBy(0)}>
                  {Math.round(appearance.zoom * 100)} %
                </button>
                <button className="btn btn--icon btn--sm" aria-label="Agrandar (Ctrl +)" title="Agrandar (Ctrl +)" onClick={() => zoomBy(1)}>
                  <Plus size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {editing && createPortal(<ThemeEditor onClose={() => setEditing(false)} />, document.body)}
    </>
  )
}

/** Tarjeta de un tema con una miniatura: fondo, panel, tres carriles y el acento. */
function ThemeCard({
  palette,
  custom,
  chosen,
  active,
  onChoose
}: {
  palette: Palette
  custom: Record<string, string> | undefined
  chosen: boolean
  active: boolean
  onChoose(): void
}) {
  const c = resolveColors(palette, custom)
  const style = {
    '--tc-ground': c.ground,
    '--tc-panel': c.panel,
    '--tc-text': c.text,
    '--tc-text3': c.text3,
    '--tc-accent': c.accent,
    '--tc-lane0': c.lane0,
    '--tc-lane1': c.lane1,
    '--tc-lane2': c.lane2
  } as CSSProperties
  return (
    <button
      role="radio"
      aria-checked={chosen}
      className={`theme-card${chosen ? ' theme-card--chosen' : ''}`}
      style={style}
      title={`${palette.name}: ${palette.description}${custom && Object.keys(custom).length > 0 ? ' (con colores propios)' : ''}`}
      onClick={onChoose}
    >
      <span className="theme-card__preview" aria-hidden>
        <span className="theme-card__side" />
        <span className="theme-card__rows">
          <span className="theme-card__row">
            <i style={{ background: 'var(--tc-lane0)' }} />
            <b />
          </span>
          <span className="theme-card__row">
            <i style={{ background: 'var(--tc-lane1)' }} />
            <b className="theme-card__selected" />
          </span>
          <span className="theme-card__row">
            <i style={{ background: 'var(--tc-lane2)' }} />
            <b />
          </span>
        </span>
      </span>
      <span className="theme-card__name">
        {palette.name}
        {chosen && <Check size={12} strokeWidth={2.5} aria-label={active ? 'en uso' : 'elegido'} />}
      </span>
    </button>
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
