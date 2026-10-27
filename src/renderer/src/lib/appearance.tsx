// Apariencia elegida por el usuario: modo (sistema, claro u oscuro), tema de cada modo, colores
// cambiados a mano, vidrio, avatares y zoom. Se guarda en las preferencias y se aplica al documento
// (variables CSS y atributos data-*), a Monaco y a las partes nativas de la ventana.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { type Locale } from '../../../shared/i18n'
import type { ThemeChoice } from '../../../shared/types'
import { api } from '../api'
import { setMonacoTheme } from '../monaco'
import { systemLocale } from './locale'
import { loadSetting, saveSetting } from './settings'
import { cssVariables, DEFAULT_DARK, DEFAULT_LIGHT, paletteById, PALETTES, resolveColors, type ColorKey, type Palette, type ThemeColors } from './themes'

export interface Appearance {
  theme: ThemeChoice
  /** Tema que se usa en modo claro y en modo oscuro (ids de lib/themes.ts). */
  lightPalette: string
  darkPalette: string
  /** Colores que el usuario cambió, por tema. */
  custom: Record<string, Partial<Record<ColorKey, string>>>
  /** Paneles translúcidos que flotan sobre el fondo. Apagado, van pegados como en GitKraken. */
  glass: boolean
  /** Fotos de los autores (GitHub o Gravatar). Apagado, solo iniciales y ningún pedido a internet. */
  avatars: boolean
  /** Foto del autor como nodo del gráfico, como en GitKraken. */
  graphAvatars: boolean
  /** Zoom de toda la interfaz (1 = 100 %). */
  zoom: number
  /** Idioma de la interfaz. */
  language: Locale
  /** Versión de las preferencias, para migrar las viejas. */
  version: number
}

const VERSION = 2

const DEFAULTS: Appearance = {
  theme: 'system',
  lightPalette: DEFAULT_LIGHT,
  darkPalette: DEFAULT_DARK,
  custom: {},
  glass: false,
  avatars: true,
  graphAvatars: true,
  zoom: 1,
  // Español si el sistema está en español; si no, inglés.
  language: systemLocale(),
  version: VERSION
}

export const ZOOM_LEVELS = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.5, 1.75, 2]

interface AppearanceState {
  appearance: Appearance
  dark: boolean
  /** Tema activo y sus colores finales (con los cambios del usuario). */
  palette: Palette
  colors: ThemeColors
  update(change: Partial<Appearance>): void
  /** Elige un tema; pasa al modo de ese tema salvo que el sistema ya esté en ese modo. */
  choosePalette(id: string): void
  setColor(key: ColorKey, value: string | null): void
  /** Reemplaza todos los cambios de un tema (al importar uno). */
  setCustom(paletteId: string, colors: Partial<Record<ColorKey, string>>): void
  zoomBy(step: 1 | -1 | 0): void
}

const fallback = paletteById(DEFAULT_LIGHT)!
const AppearanceContext = createContext<AppearanceState>({
  appearance: DEFAULTS,
  dark: false,
  palette: fallback,
  colors: fallback.colors,
  update: () => undefined,
  choosePalette: () => undefined,
  setColor: () => undefined,
  setCustom: () => undefined,
  zoomBy: () => undefined
})

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** Preferencias guardadas por una versión anterior: el vidrio venía prendido y ahora va apagado. */
function loadAppearance(): Appearance {
  // loadSetting completa con los valores por defecto: con versión 0 de base, una preferencia vieja
  // (que no tenía versión) se reconoce como vieja.
  const saved = loadSetting<Appearance>('appearance', { ...DEFAULTS, version: 0 })
  const migrated = saved.version === VERSION ? saved : { ...saved, glass: false, version: VERSION }
  const light = paletteById(migrated.lightPalette)
  const dark = paletteById(migrated.darkPalette)
  return {
    ...migrated,
    lightPalette: light?.kind === 'light' ? light.id : DEFAULT_LIGHT,
    darkPalette: dark?.kind === 'dark' ? dark.id : DEFAULT_DARK,
    zoom: ZOOM_LEVELS.includes(migrated.zoom) ? migrated.zoom : 1,
    language: migrated.language === 'en' ? 'en' : 'es'
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance)
  const [systemIsDark, setSystemIsDark] = useState(systemDark)
  const dark = appearance.theme === 'dark' || (appearance.theme === 'system' && systemIsDark)
  const palette = paletteById(dark ? appearance.darkPalette : appearance.lightPalette) ?? fallback
  const overrides = appearance.custom[palette.id]
  const colors = useMemo(() => resolveColors(palette, overrides), [palette, overrides])

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemIsDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => saveSetting('appearance', appearance), [appearance])

  // Otra ventana de la app cambió la apariencia (comparten las preferencias): se aplica acá también.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gitono:appearance') setAppearance(loadAppearance())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = palette.kind
    root.dataset.glass = appearance.glass ? 'on' : 'off'
    for (const [name, value] of Object.entries(cssVariables(colors))) root.style.setProperty(name, value)
    setMonacoTheme(colors, palette.kind === 'dark')
    void api.setAppearance({ theme: appearance.theme, titleBar: { color: colors.ground, symbolColor: colors.text } })
  }, [colors, palette.kind, appearance.glass, appearance.theme])

  useEffect(() => api.setZoom(appearance.zoom), [appearance.zoom])
  // El idioma se fija al cargar (lib/locale.ts); para cambiarlo se guarda y se recarga la ventana.
  const loadedLanguage = useRef(appearance.language)
  useEffect(() => {
    document.documentElement.lang = appearance.language
    void api.setLocale(appearance.language)
    // El efecto que guarda las preferencias ya corrió (está declarado antes).
    if (appearance.language !== loadedLanguage.current) window.location.reload()
  }, [appearance.language])

  const value = useMemo<AppearanceState>(() => {
    const update = (change: Partial<Appearance>) => setAppearance((prev) => ({ ...prev, ...change }))
    return {
      appearance,
      dark,
      palette,
      colors,
      update,
      choosePalette: (id) => {
        const chosen = paletteById(id)
        if (!chosen) return
        setAppearance((prev) => {
          const next = { ...prev, [chosen.kind === 'dark' ? 'darkPalette' : 'lightPalette']: chosen.id }
          const systemMatches = prev.theme === 'system' && systemIsDark === (chosen.kind === 'dark')
          return systemMatches ? next : { ...next, theme: chosen.kind }
        })
      },
      setColor: (key, color) =>
        setAppearance((prev) => {
          const current = { ...(prev.custom[palette.id] ?? {}) }
          if (color === null) delete current[key]
          else current[key] = color
          return { ...prev, custom: { ...prev.custom, [palette.id]: current } }
        }),
      setCustom: (paletteId, custom) => setAppearance((prev) => ({ ...prev, custom: { ...prev.custom, [paletteId]: custom } })),
      zoomBy: (step) =>
        setAppearance((prev) => {
          if (step === 0) return { ...prev, zoom: 1 }
          const index = ZOOM_LEVELS.indexOf(prev.zoom)
          const next = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, (index === -1 ? 2 : index) + step))]
          return { ...prev, zoom: next }
        })
    }
  }, [appearance, dark, palette, colors, systemIsDark])

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export const useAppearance = () => useContext(AppearanceContext)

export { PALETTES }
