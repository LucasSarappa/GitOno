import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, layoutGrid, matchingPreset, moveCenter, movePanel, nearestSide, normalizeLayout, PRESETS, resizePanel, setPanelOpen } from './dock'

describe('layoutGrid', () => {
  it('disposición clásica: ramas, gráfico y detalle en una fila', () => {
    const grid = layoutGrid(DEFAULT_LAYOUT, '1px')
    expect(grid.columns).toBe('220px 1px minmax(0, 1fr) 1px 348px')
    expect(grid.rows).toBe('minmax(0, 1fr)')
    expect(grid.panels.refs?.panel).toEqual({ gridColumn: '1 / 2', gridRow: '1 / -1' })
    expect(grid.panels.details?.panel).toEqual({ gridColumn: '-2 / -1', gridRow: '1 / -1' })
    expect(grid.panels.details?.splitter.gridColumn).toBe('-3 / -2')
    expect(grid.center).toEqual({ gridColumn: '3 / -3', gridRow: '1 / -1' })
  })

  it('detalle abajo: ocupa solo el ancho que dejan las ramas', () => {
    const grid = layoutGrid(movePanel(DEFAULT_LAYOUT, 'details', 'bottom', 'inner'), '1px')
    expect(grid.columns).toBe('220px 1px minmax(0, 1fr)')
    expect(grid.rows).toBe('minmax(0, 1fr) 1px 300px')
    expect(grid.panels.details?.panel).toEqual({ gridRow: '-2 / -1', gridColumn: '3 / -1' })
    expect(grid.panels.refs?.panel.gridRow).toBe('1 / -1')
    expect(grid.center).toEqual({ gridColumn: '3 / -1', gridRow: '1 / -3' })
  })

  it('un panel afuera de todo ocupa el borde completo', () => {
    const grid = layoutGrid(movePanel(DEFAULT_LAYOUT, 'details', 'top', 'outer'), '8px')
    expect(grid.panels.details?.panel).toEqual({ gridRow: '1 / 2', gridColumn: '1 / -1' })
    expect(grid.panels.refs?.panel).toEqual({ gridColumn: '1 / 2', gridRow: '3 / -1' })
  })

  it('dos paneles del mismo lado quedan uno al lado del otro', () => {
    const grid = layoutGrid(PRESETS.find((p) => p.id === 'grafico-derecha')!.layout, '1px')
    expect(grid.columns).toBe('220px 1px 348px 1px minmax(0, 1fr)')
    expect(grid.panels.details?.panel.gridColumn).toBe('3 / 4')
    expect(grid.center.gridColumn).toBe('5 / -1')
  })

  it('los paneles cerrados no ocupan lugar', () => {
    const grid = layoutGrid(setPanelOpen(DEFAULT_LAYOUT, 'refs', false), '1px')
    expect(grid.columns).toBe('minmax(0, 1fr) 1px 348px')
    expect(grid.panels.refs).toBeUndefined()
  })
})

describe('mover paneles', () => {
  it('al pasar de costado a abajo el panel toma un alto razonable', () => {
    const layout = movePanel(DEFAULT_LAYOUT, 'details', 'bottom', 'inner')
    expect(layout.docks.find((d) => d.panel === 'details')).toMatchObject({ side: 'bottom', size: 300 })
  })

  it('mover el gráfico a la izquierda pasa las ramas a la derecha', () => {
    const layout = moveCenter(DEFAULT_LAYOUT, 'left')
    expect(layout.docks.map((d) => `${d.panel}:${d.side}`)).toEqual(['refs:right', 'details:right'])
  })

  it('mover el gráfico hacia un borde que ya toca no cambia nada', () => {
    expect(moveCenter(DEFAULT_LAYOUT, 'top')).toBe(DEFAULT_LAYOUT)
  })

  it('reconoce los presets y limita los tamaños', () => {
    expect(matchingPreset(DEFAULT_LAYOUT)).toBe('clasica')
    expect(matchingPreset(movePanel(DEFAULT_LAYOUT, 'refs', 'top', 'inner'))).toBe('ramas-arriba')
    expect(matchingPreset(movePanel(DEFAULT_LAYOUT, 'refs', 'bottom', 'outer'))).toBeNull()
    expect(resizePanel(DEFAULT_LAYOUT, 'refs', 5).docks[0].size).toBe(120)
  })

  it('arregla disposiciones guardadas rotas', () => {
    const fixed = normalizeLayout({ docks: [{ panel: 'refs', side: 'arriba' as never, size: 1, open: true }, { panel: 'details', side: 'top', size: 9999, open: false }] })
    expect(fixed.docks).toEqual([
      { panel: 'details', side: 'top', size: 900, open: false },
      { panel: 'refs', side: 'left', size: 220, open: true }
    ])
  })
})

describe('nearestSide', () => {
  it('elige el borde más cercano, relativo al tamaño', () => {
    const rect = { left: 0, top: 0, width: 1000, height: 400 }
    expect(nearestSide(rect, 50, 200)).toBe('left')
    expect(nearestSide(rect, 990, 200)).toBe('right')
    expect(nearestSide(rect, 500, 20)).toBe('top')
    expect(nearestSide(rect, 500, 390)).toBe('bottom')
  })
})
