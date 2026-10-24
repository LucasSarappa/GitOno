// Temas de color. Cada tema es una paleta de colores base; los tonos intermedios (bordes,
// selección, vidrio, sombras) salen de estos en styles.css con color-mix. Así el usuario puede
// cambiar cualquier color y el resto se acomoda solo.

export type ColorKey =
  | 'ground'
  | 'panel'
  | 'raised'
  | 'text'
  | 'text2'
  | 'text3'
  | 'accent'
  | 'accentText'
  | 'onAccent'
  | 'added'
  | 'deleted'
  | 'modified'
  | 'renamed'
  | 'lane0'
  | 'lane1'
  | 'lane2'
  | 'lane3'
  | 'lane4'
  | 'lane5'
  | 'lane6'
  | 'lane7'

export type ThemeColors = Record<ColorKey, string>

export interface Palette {
  id: string
  name: string
  kind: 'light' | 'dark'
  /** Una línea para la tarjeta del tema. */
  description: string
  colors: ThemeColors
}

const lanes = (list: string[]) =>
  Object.fromEntries(list.map((color, i) => [`lane${i}`, color])) as Pick<ThemeColors, `lane${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`>

export const PALETTES: Palette[] = [
  {
    id: 'crema',
    name: 'Crema',
    kind: 'light',
    description: 'El pelaje de Ono: crema, damasco y caramelo.',
    colors: {
      ground: '#eee6dc',
      panel: '#fbf7f2',
      raised: '#ffffff',
      text: '#2a1f18',
      text2: '#66544a',
      text3: '#76655a',
      accent: '#a35f2a',
      accentText: '#8a4c1e',
      onAccent: '#ffffff',
      added: '#2a7d4f',
      deleted: '#b93d33',
      modified: '#8f620c',
      renamed: '#2f6fbf',
      ...lanes(['#d9822b', '#3d84c6', '#2f9e6c', '#c74f74', '#8467c9', '#1f9a9a', '#b8922a', '#6f7f90'])
    }
  },
  {
    id: 'papel',
    name: 'Papel',
    kind: 'light',
    description: 'Blanco y gris neutro, sin tinte.',
    colors: {
      ground: '#eceef1',
      panel: '#ffffff',
      raised: '#ffffff',
      text: '#1f2328',
      text2: '#57606a',
      text3: '#656d76',
      accent: '#0969da',
      accentText: '#0757b5',
      onAccent: '#ffffff',
      added: '#1a7f37',
      deleted: '#cf222e',
      modified: '#9a6700',
      renamed: '#0969da',
      ...lanes(['#0969da', '#1a7f37', '#bf3989', '#c27a00', '#8250df', '#cf222e', '#1b7c83', '#bc4c00'])
    }
  },
  {
    id: 'niebla',
    name: 'Niebla',
    kind: 'light',
    description: 'Gris azulado, frío y tranquilo.',
    colors: {
      ground: '#e2e7ef',
      panel: '#f4f6fa',
      raised: '#ffffff',
      text: '#2e3440',
      text2: '#4c566a',
      text3: '#5a6578',
      accent: '#4e73a3',
      accentText: '#3f6190',
      onAccent: '#ffffff',
      added: '#3b7a4b',
      deleted: '#b33a44',
      modified: '#8c6209',
      renamed: '#4e73a3',
      ...lanes(['#4f7cb4', '#5b8a3c', '#b45a8c', '#c27a22', '#7a5fb8', '#2f8f8f', '#b84a4a', '#6b7a8f'])
    }
  },
  {
    id: 'solar',
    name: 'Solar',
    kind: 'light',
    description: 'Papel sepia de bajo contraste para muchas horas.',
    colors: {
      ground: '#eee8d5',
      panel: '#fdf6e3',
      raised: '#fffbf0',
      text: '#073642',
      text2: '#4b5f66',
      text3: '#56696f',
      accent: '#1f75b8',
      accentText: '#1b6aa3',
      onAccent: '#ffffff',
      added: '#5d7000',
      deleted: '#c0302b',
      modified: '#8f6a00',
      renamed: '#1b6aa3',
      ...lanes(['#268bd2', '#2aa198', '#859900', '#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4'])
    }
  },
  {
    id: 'cacao',
    name: 'Cacao',
    kind: 'dark',
    description: 'Ono de noche: cacao y espresso con acento caramelo.',
    colors: {
      ground: '#16110e',
      panel: '#211a16',
      raised: '#2c231d',
      text: '#f3e9df',
      text2: '#c4b2a3',
      text3: '#a28e7e',
      accent: '#e2a26a',
      accentText: '#f0b783',
      onAccent: '#2a1709',
      added: '#63c58f',
      deleted: '#f0786c',
      modified: '#e6b54a',
      renamed: '#74aaf0',
      ...lanes(['#f0a050', '#6aaaf0', '#58c58e', '#f07a9c', '#ab8ff0', '#4cc6c2', '#e2c05a', '#9aaabb'])
    }
  },
  {
    id: 'abismo',
    name: 'Abismo',
    kind: 'dark',
    description: 'Azul profundo con turquesa, como GitKraken.',
    colors: {
      ground: '#181b23',
      panel: '#1f232d',
      raised: '#292e3a',
      text: '#e6e9ef',
      text2: '#aab2c3',
      text3: '#8a93a6',
      accent: '#2ec4b6',
      accentText: '#5fd9cc',
      onAccent: '#062421',
      added: '#4fd18b',
      deleted: '#ff6b6b',
      modified: '#f2c14e',
      renamed: '#6cb6ff',
      ...lanes(['#1ab9d6', '#4d86f7', '#a66cf5', '#e04fc4', '#ef5a82', '#f2803a', '#f2cc3a', '#5fd068'])
    }
  },
  {
    id: 'grafito',
    name: 'Grafito',
    kind: 'dark',
    description: 'Gris neutro y mínimo; el color queda para las ramas.',
    colors: {
      ground: '#161617',
      panel: '#1d1d1f',
      raised: '#27272a',
      text: '#ececee',
      text2: '#a8a8ae',
      text3: '#8f8f96',
      accent: '#8ab4ff',
      accentText: '#a8c7ff',
      onAccent: '#0b1a33',
      added: '#5bd08a',
      deleted: '#f2706a',
      modified: '#e8c35a',
      renamed: '#8ab4ff',
      ...lanes(['#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#bb9af7', '#7dcfff', '#ff9e64', '#c0caf5'])
    }
  },
  {
    id: 'contraste',
    name: 'Alto contraste',
    kind: 'dark',
    description: 'Negro puro y colores intensos, para ver mejor.',
    colors: {
      ground: '#000000',
      panel: '#0a0a0a',
      raised: '#161616',
      text: '#ffffff',
      text2: '#e0e0e0',
      text3: '#c4c4c4',
      accent: '#ffd400',
      accentText: '#ffe14d',
      onAccent: '#000000',
      added: '#3fe08a',
      deleted: '#ff6f66',
      modified: '#ffd400',
      renamed: '#5cb8ff',
      ...lanes(['#ffd400', '#5cb8ff', '#3fe08a', '#ff6ad5', '#ff9f43', '#a98bff', '#4ff0e6', '#ffffff'])
    }
  }
]

export const DEFAULT_LIGHT = 'crema'
export const DEFAULT_DARK = 'cacao'

export const COLOR_GROUPS: { title: string; keys: { key: ColorKey; label: string }[] }[] = [
  {
    title: 'Fondo y paneles',
    keys: [
      { key: 'ground', label: 'Fondo' },
      { key: 'panel', label: 'Paneles' },
      { key: 'raised', label: 'Menús y diálogos' }
    ]
  },
  {
    title: 'Texto',
    keys: [
      { key: 'text', label: 'Principal' },
      { key: 'text2', label: 'Secundario' },
      { key: 'text3', label: 'Tenue' }
    ]
  },
  {
    title: 'Acento',
    keys: [
      { key: 'accent', label: 'Acento (selección y botón principal)' },
      { key: 'accentText', label: 'Enlaces y texto de acento' },
      { key: 'onAccent', label: 'Texto sobre el acento' }
    ]
  },
  {
    title: 'Cambios',
    keys: [
      { key: 'added', label: 'Agregado' },
      { key: 'deleted', label: 'Borrado' },
      { key: 'modified', label: 'Modificado' },
      { key: 'renamed', label: 'Renombrado' }
    ]
  },
  {
    title: 'Carriles del gráfico',
    keys: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ key: `lane${i}` as ColorKey, label: `Carril ${i + 1}` }))
  }
]

export const COLOR_KEYS = COLOR_GROUPS.flatMap((g) => g.keys.map((k) => k.key))

export const paletteById = (id: string): Palette | undefined => PALETTES.find((p) => p.id === id)

const HEX = /^#[0-9a-f]{6}$/i

/** Normaliza un color escrito a mano ("#ABC", "abcdef") a "#aabbcc", o null si no es válido. */
export function normalizeHex(value: string): string | null {
  let hex = value.trim().toLowerCase()
  if (!hex.startsWith('#')) hex = `#${hex}`
  if (/^#[0-9a-f]{3}$/.test(hex)) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
  return HEX.test(hex) ? hex : null
}

/** Colores finales de un tema: los de la paleta con los cambios del usuario encima (solo los válidos). */
export function resolveColors(palette: Palette, overrides: Partial<Record<string, string>> = {}): ThemeColors {
  const colors = { ...palette.colors }
  for (const key of COLOR_KEYS) {
    const value = overrides[key]
    const hex = value ? normalizeHex(value) : null
    if (hex) colors[key] = hex
  }
  return colors
}

/** Variables CSS que aplica cada color (las derivadas viven en styles.css). */
export function cssVariables(colors: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {
    '--ground': colors.ground,
    '--panel': colors.panel,
    '--raised': colors.raised,
    '--text': colors.text,
    '--text-2': colors.text2,
    '--text-3': colors.text3,
    '--accent': colors.accent,
    '--accent-ink': colors.accentText,
    '--accent-on': colors.onAccent,
    '--added': colors.added,
    '--deleted': colors.deleted,
    '--modified': colors.modified,
    '--renamed': colors.renamed
  }
  for (let i = 0; i < 8; i++) vars[`--lane-${i}`] = colors[`lane${i}` as ColorKey]
  return vars
}

// ---------- Contraste (WCAG 2) ----------

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** Relación de contraste entre dos colores, de 1 a 21. 4,5 es el mínimo para texto normal. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** Pares que tienen que leerse bien, con el mínimo que pide WCAG AA. */
export const CONTRAST_CHECKS: { fg: ColorKey; bg: ColorKey; min: number; label: string }[] = [
  { fg: 'text', bg: 'panel', min: 4.5, label: 'Texto sobre los paneles' },
  { fg: 'text2', bg: 'panel', min: 4.5, label: 'Texto secundario sobre los paneles' },
  { fg: 'text3', bg: 'panel', min: 4.5, label: 'Texto tenue sobre los paneles' },
  { fg: 'text', bg: 'ground', min: 4.5, label: 'Texto sobre el fondo' },
  { fg: 'text2', bg: 'ground', min: 4.5, label: 'Texto secundario sobre el fondo' },
  { fg: 'accentText', bg: 'panel', min: 4.5, label: 'Texto de acento sobre los paneles' },
  { fg: 'onAccent', bg: 'accent', min: 4.5, label: 'Texto sobre el acento' }
]

/** Problemas de contraste de un tema (para avisar en el editor de colores). */
export function contrastProblems(colors: ThemeColors): { label: string; ratio: number; min: number }[] {
  return CONTRAST_CHECKS.map((check) => ({ ...check, ratio: contrastRatio(colors[check.fg], colors[check.bg]) })).filter(
    (c) => c.ratio < c.min
  )
}

/** Tema exportado como texto, para compartirlo o guardarlo. */
export function exportTheme(palette: Palette, colors: ThemeColors): string {
  return JSON.stringify({ gitono: 'tema', base: palette.id, kind: palette.kind, colors }, null, 2)
}

/** Lee un tema exportado. Devuelve los colores válidos y la paleta base, o un error legible. */
export function importTheme(text: string): { base: Palette; overrides: Partial<ThemeColors> } | { error: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'No es un tema de GitOno: el texto no es JSON válido.' }
  }
  const record = (data ?? {}) as { base?: unknown; colors?: unknown }
  const base = typeof record.base === 'string' ? paletteById(record.base) : undefined
  if (!base || typeof record.colors !== 'object' || record.colors === null) {
    return { error: 'No es un tema de GitOno: falta la paleta base o los colores.' }
  }
  const overrides: Partial<ThemeColors> = {}
  for (const key of COLOR_KEYS) {
    const value = (record.colors as Record<string, unknown>)[key]
    const hex = typeof value === 'string' ? normalizeHex(value) : null
    if (hex && hex !== base.colors[key]) overrides[key] = hex
  }
  return { base, overrides }
}
