import { Check, Minus, Monitor, Moon, Palette as PaletteIcon, Pipette, Plus, Sun } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { ThemeChoice } from '../../../shared/types'
import { useAppearance } from '../lib/appearance'
import { PALETTES, resolveColors, type Palette } from '../lib/themes'
import { ThemeEditor } from './ThemeEditor'
import { t, type Locale } from '../../../shared/i18n'

/** Cada idioma se nombra en su propio idioma, para encontrarlo aunque no se entienda el otro. */
const LANGUAGES: { id: Locale; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' }
]

const MODES: { id: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { id: 'system', label: t('Sistema'), Icon: Monitor },
  { id: 'light', label: t('Claro'), Icon: Sun },
  { id: 'dark', label: t('Oscuro'), Icon: Moon }
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
        aria-label={t('Apariencia')}
        aria-expanded={open}
        title={t('Apariencia: temas, colores y zoom')}
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
            aria-label={t('Apariencia')}
            style={{ top: position.top, right: position.right, maxHeight: `calc(100vh - ${position.top + 12}px)` }}
          >
            <div className="menu__group">
              <span className="menu__label">{t('Modo')}</span>
              <div className="segmented" role="radiogroup" aria-label={t('Modo')}>
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
                <span className="menu__label">{kind === 'dark' ? t('Temas oscuros') : t('Temas claros')}</span>
                <div className="theme-grid" role="radiogroup" aria-label={kind === 'dark' ? t('Temas oscuros') : t('Temas claros')}>
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
              {t('Personalizar los colores de {name}…', { name: palette.name })}
            </button>

            <div className="menu__separator" />

            <Switch
              label={t('Paneles flotantes con vidrio')}
              description={t('Translúcidos y separados. Apagado, van pegados como en GitKraken.')}
              checked={appearance.glass}
              onChange={(glass) => update({ glass })}
            />
            <Switch
              label={t('Fotos de los autores')}
              description={t('Desde GitHub o Gravatar. Apagado, no se hace ningún pedido a internet.')}
              checked={appearance.avatars}
              onChange={(avatars) => update({ avatars })}
            />
            <Switch
              label={t('Foto del autor en el gráfico')}
              description={t('Cada commit se dibuja con la foto (o las iniciales) de su autor.')}
              checked={appearance.graphAvatars}
              onChange={(graphAvatars) => update({ graphAvatars })}
            />

            <div className="menu__row">
              <span className="menu__label">{t('Idioma')}</span>
              <div className="segmented segmented--tiny" role="radiogroup" aria-label={t('Idioma')}>
                {LANGUAGES.map(({ id, label }) => (
                  <button
                    key={id}
                    role="radio"
                    lang={id}
                    aria-checked={appearance.language === id}
                    className={`segmented__item${appearance.language === id ? ' segmented__item--active' : ''}`}
                    onClick={() => update({ language: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="menu__row">
              <span className="menu__label">{t('Zoom')}</span>
              <div className="zoom-control">
                <button className="btn btn--icon btn--sm" aria-label={t('Achicar (Ctrl −)')} title={t('Achicar (Ctrl −)')} onClick={() => zoomBy(-1)}>
                  <Minus size={13} strokeWidth={2} />
                </button>
                <button className="zoom-control__value" title={t('Volver a 100 % (Ctrl 0)')} onClick={() => zoomBy(0)}>
                  {Math.round(appearance.zoom * 100)} %
                </button>
                <button className="btn btn--icon btn--sm" aria-label={t('Agrandar (Ctrl +)')} title={t('Agrandar (Ctrl +)')} onClick={() => zoomBy(1)}>
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
      title={`${palette.name}: ${palette.description}${custom && Object.keys(custom).length > 0 ? t(' (con colores propios)') : ''}`}
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
        {chosen && <Check size={12} strokeWidth={2.5} aria-label={active ? t('en uso') : t('elegido')} />}
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
