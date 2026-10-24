import { describe, expect, it } from 'vitest'
import {
  contrastProblems,
  contrastRatio,
  COLOR_KEYS,
  CONTRAST_CHECKS,
  cssVariables,
  exportTheme,
  importTheme,
  normalizeHex,
  PALETTES,
  paletteById,
  resolveColors
} from './themes'

describe('paletas', () => {
  it('cada tema tiene todos los colores y ids únicos', () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length)
    for (const palette of PALETTES) {
      for (const key of COLOR_KEYS) expect(normalizeHex(palette.colors[key]), `${palette.id}.${key}`).toBe(palette.colors[key])
    }
  })

  it('hay temas claros y oscuros', () => {
    expect(PALETTES.filter((p) => p.kind === 'light').length).toBeGreaterThanOrEqual(3)
    expect(PALETTES.filter((p) => p.kind === 'dark').length).toBeGreaterThanOrEqual(3)
  })

  // Los temas que trae la app tienen que cumplir WCAG AA: no se puede depender de mirarlos a ojo.
  it.each(PALETTES.map((p) => [p.name, p] as const))('%s cumple el contraste mínimo', (_name, palette) => {
    const problems = contrastProblems(palette.colors)
    expect(problems.map((p) => `${p.label}: ${p.ratio.toFixed(2)}`)).toEqual([])
  })

  it('los colores de cambios y carriles se distinguen del panel', () => {
    for (const palette of PALETTES) {
      for (const key of ['added', 'deleted', 'modified', 'renamed'] as const) {
        expect(contrastRatio(palette.colors[key], palette.colors.panel), `${palette.id}.${key}`).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

describe('contrastRatio', () => {
  it('negro sobre blanco es 21 y un color contra sí mismo es 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  })
})

describe('colores del usuario', () => {
  it('normaliza lo que se escribe a mano', () => {
    expect(normalizeHex('ABC')).toBe('#aabbcc')
    expect(normalizeHex('#A1B2C3')).toBe('#a1b2c3')
    expect(normalizeHex('rojo')).toBeNull()
  })

  it('aplica solo los cambios válidos encima de la paleta', () => {
    const base = paletteById('cacao')!
    const colors = resolveColors(base, { accent: '#00ff00', text: 'cualquiera' })
    expect(colors.accent).toBe('#00ff00')
    expect(colors.text).toBe(base.colors.text)
    expect(cssVariables(colors)['--accent']).toBe('#00ff00')
    expect(cssVariables(colors)['--lane-7']).toBe(base.colors.lane7)
  })

  it('avisa si un cambio deja texto ilegible', () => {
    const base = paletteById('crema')!
    const problems = contrastProblems(resolveColors(base, { text3: '#eeeeee' }))
    expect(problems.map((p) => p.label)).toContain('Texto tenue sobre los paneles')
    expect(CONTRAST_CHECKS.length).toBeGreaterThan(0)
  })

  it('exporta e importa un tema, y rechaza texto que no lo es', () => {
    const base = paletteById('abismo')!
    const colors = resolveColors(base, { accent: '#123456' })
    const imported = importTheme(exportTheme(base, colors))
    expect('error' in imported).toBe(false)
    if ('error' in imported) return
    expect(imported.base.id).toBe('abismo')
    expect(imported.overrides).toEqual({ accent: '#123456' })
    expect(importTheme('hola')).toHaveProperty('error')
    expect(importTheme('{"base":"inventado","colors":{}}')).toHaveProperty('error')
  })
})
