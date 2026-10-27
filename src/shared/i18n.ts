// Idioma de la interfaz. Los textos se escriben en español dentro de t('…') y, en inglés, se buscan
// en el diccionario de i18n.en.ts (como gettext: el texto en español es la clave). Las partes que
// cambian van entre llaves: t('Fusionar {rama} en {destino}', { rama, destino }).
// Lo usan la interfaz y el proceso principal (los mensajes de error de Git), así que no importa nada
// de Electron ni de React. El vocabulario de cada idioma está en docs/glosario.md.

import { EN } from './i18n.en'

export type Locale = 'es' | 'en'

let current: Locale = 'es'

export function setLocale(locale: Locale): void {
  current = locale === 'en' ? 'en' : 'es'
}

export const getLocale = (): Locale => current

/** Etiqueta BCP 47 para fechas y números ("hace 3 días", "1.234"). */
export const intlLocale = (): string => (current === 'en' ? 'en-US' : 'es-AR')

type Vars = Record<string, string | number | null | undefined>

const fill = (template: string, vars?: Vars) =>
  vars ? template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key] ?? '') : match)) : template

/** Traduce un texto escrito en español. Si falta en el diccionario, queda en español. */
export function t(text: string, vars?: Vars): string {
  return fill(current === 'en' ? (EN[text] ?? text) : text, vars)
}

/** Singular o plural según la cantidad; {n} es la cantidad. */
export function tn(count: number, one: string, many: string, vars?: Vars): string {
  return t(count === 1 ? one : many, { n: count.toLocaleString(intlLocale()), ...vars })
}
