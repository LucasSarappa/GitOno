import { describe, expect, it } from 'vitest'
import { DEFAULT_COLUMNS, gridTemplate, layoutColumns, moveColumn, normalizeColumns } from './columns'

const ids = (layout: { id: string }[]) => layout.map((c) => c.id)

const ALL = { ...DEFAULT_COLUMNS, hidden: [] }

describe('layoutColumns', () => {
  it('por defecto, como GitKraken: rama / tag, gráfico y mensaje', () => {
    expect(ids(layoutColumns(DEFAULT_COLUMNS, 1400, 80))).toEqual(['refs', 'graph', 'message'])
  })

  it('con espacio de sobra muestra todas, y el mensaje se queda con lo que sobra', () => {
    const layout = layoutColumns(ALL, 1400, 80)
    expect(ids(layout)).toEqual(['refs', 'graph', 'message', 'author', 'date', 'sha'])
    expect(gridTemplate(layout)).toBe('156px 80px minmax(0, 1fr) 144px 112px 72px')
  })

  it('si falta espacio oculta SHA, fecha y autor, en ese orden', () => {
    // 156 + 80 + 144 + 112 + 72 = 564 de columnas fijas.
    expect(ids(layoutColumns(ALL, 564 + 239, 80))).toEqual(['refs', 'graph', 'message', 'author', 'date'])
    expect(ids(layoutColumns(ALL, 500, 80))).toEqual(['refs', 'graph', 'message'])
  })

  it('respeta las ocultas, el orden y los anchos elegidos', () => {
    const config = { order: ['sha', 'message', 'author', 'date'] as const, widths: { graph: 200, author: 90 }, hidden: ['date', 'refs'] as const }
    const layout = layoutColumns({ order: [...config.order], widths: config.widths, hidden: [...config.hidden], version: 2 }, 2000, 80)
    expect(ids(layout)).toEqual(['graph', 'sha', 'message', 'author'])
    expect(gridTemplate(layout)).toBe('200px 72px minmax(0, 1fr) 90px')
  })
})

describe('normalizeColumns', () => {
  it('completa columnas que falten y no deja ocultar el mensaje', () => {
    const fixed = normalizeColumns({ order: ['author', 'author', 'graph'], widths: {}, hidden: ['message', 'sha'] })
    expect(fixed.order).toEqual(['author', 'message', 'date', 'sha'])
    expect(fixed.hidden).toEqual(['sha'])
  })
})

describe('migración', () => {
  it('un ancho de gráfico de antes de las fotos en los nodos vuelve a ajustarse a los carriles', () => {
    const old = normalizeColumns({ order: ['message'], widths: { graph: 70, author: 90 }, hidden: [] })
    expect(old.widths).toEqual({ author: 90 })
    expect(normalizeColumns({ ...old, widths: { graph: 70 } }).widths.graph).toBe(70)
  })
})

describe('moveColumn', () => {
  it('mueve una columna antes o después de otra', () => {
    expect(moveColumn(DEFAULT_COLUMNS, 'sha', 'message', false).order).toEqual(['sha', 'message', 'author', 'date'])
    expect(moveColumn(DEFAULT_COLUMNS, 'message', 'date', true).order).toEqual(['author', 'date', 'message', 'sha'])
  })

  it('el gráfico y las etiquetas no se mueven', () => {
    expect(moveColumn(DEFAULT_COLUMNS, 'graph', 'sha', true)).toBe(DEFAULT_COLUMNS)
  })
})
