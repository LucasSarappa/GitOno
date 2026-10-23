// Apariencia elegida por el usuario: tema (sistema, claro u oscuro), efecto vidrio y avatares.
// Se guarda en las preferencias y se aplica al documento (atributos data-*), a Monaco y a las
// partes nativas de la ventana (diálogos y barra de título).

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ThemeChoice } from '../../../shared/types'
import { api } from '../api'
import { setMonacoTheme } from '../monaco'
import { loadSetting, saveSetting } from './settings'

export interface Appearance {
  theme: ThemeChoice
  /** Paneles translúcidos con desenfoque. Apagado, los paneles son sólidos. */
  glass: boolean
  /** Fotos de los autores (GitHub o Gravatar). Apagado, solo iniciales y ningún pedido a internet. */
  avatars: boolean
}

const DEFAULTS: Appearance = { theme: 'system', glass: true, avatars: true }

interface AppearanceState {
  appearance: Appearance
  dark: boolean
  update(change: Partial<Appearance>): void
}

const AppearanceContext = createContext<AppearanceState>({ appearance: DEFAULTS, dark: false, update: () => undefined })

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(() => loadSetting('appearance', DEFAULTS))
  const [systemIsDark, setSystemIsDark] = useState(systemDark)
  const dark = appearance.theme === 'dark' || (appearance.theme === 'system' && systemIsDark)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemIsDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    saveSetting('appearance', appearance)
    const root = document.documentElement
    root.dataset.theme = dark ? 'dark' : 'light'
    root.dataset.glass = appearance.glass ? 'on' : 'off'
    setMonacoTheme(dark)
    // Los colores de la barra nativa salen de las mismas variables CSS que la interfaz.
    const styles = getComputedStyle(root)
    void api.setAppearance({
      theme: appearance.theme,
      titleBar: { color: styles.getPropertyValue('--ground').trim(), symbolColor: styles.getPropertyValue('--text').trim() }
    })
  }, [appearance, dark])

  const value = useMemo<AppearanceState>(
    () => ({ appearance, dark, update: (change) => setAppearance((prev) => ({ ...prev, ...change })) }),
    [appearance, dark]
  )
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export const useAppearance = () => useContext(AppearanceContext)
