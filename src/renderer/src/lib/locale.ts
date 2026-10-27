// Fija el idioma antes de que se cargue el resto de la interfaz: main.tsx lo importa primero, así
// también se traducen los textos que se arman al cargar cada módulo (columnas, temas, menús fijos).
// Por eso cambiar de idioma recarga la ventana.

import { getLocale, setLocale, type Locale } from '../../../shared/i18n'
import { loadSetting } from './settings'

export const systemLocale = (): Locale => (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en')

const saved = loadSetting<{ language?: Locale }>('appearance', {})
setLocale(saved.language ?? systemLocale())

// Monaco trae sus textos en español (monaco.ts importa 'monaco-editor/nls/lang/es', y ese import
// tiene que ser fijo). En inglés se ignora lo que ese módulo guarda, así el visor queda con sus
// textos originales en inglés.
if (getLocale() === 'en') {
  for (const key of ['_VSCODE_NLS_MESSAGES', '_VSCODE_NLS_LANGUAGE']) {
    Object.defineProperty(globalThis, key, { get: () => undefined, set: () => undefined, configurable: true })
  }
}
