import { describe, expect, it } from 'vitest'
import { computeGraph } from './graph'

const c = (sha: string, ...parents: string[]) => ({ sha, parents })

describe('computeGraph', () => {
  it('historia lineal: todo en un carril', () => {
    const graph = computeGraph([c('c3', 'c2'), c('c2', 'c1'), c('c1')])
    expect(graph.width).toBe(1)
    expect(graph.rows.map((r) => r.column)).toEqual([0, 0, 0])
    // La punta no tiene línea arriba y el primer commit no tiene línea abajo.
    expect(graph.rows[0].top).toEqual([])
    expect(graph.rows[0].bottom).toEqual([{ from: 0, to: 0, color: 0 }])
    expect(graph.rows[2].top).toEqual([{ from: 0, to: 0, color: 0 }])
    expect(graph.rows[2].bottom).toEqual([])
  })

  it('merge: la rama mergeada abre un carril nuevo que vuelve al punto donde nació', () => {
    //  M      merge de F1 en B1
    //  | F1
    //  B1 |
    //  B0     padre común
    const graph = computeGraph([c('M', 'B1', 'F1'), c('F1', 'B0'), c('B1', 'B0'), c('B0')])
    expect(graph.width).toBe(2)
    expect(graph.rows.map((r) => r.column)).toEqual([0, 1, 0, 0])

    const [merge, feature, base, root] = graph.rows
    expect(merge.bottom).toEqual([
      { from: 0, to: 1, color: 1 },
      { from: 0, to: 0, color: 0 }
    ])
    expect(feature.top).toEqual([
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 1, color: 1 }
    ])
    expect(feature.color).toBe(1)
    expect(base.bottom).toEqual([
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 1, color: 1 }
    ])
    // Los dos carriles esperaban a B0: el de la derecha converge en el nodo.
    expect(root.top).toEqual([
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 0, color: 1 }
    ])
    expect(root.bottom).toEqual([])
  })

  it('dos ramas con puntas distintas usan carriles distintos', () => {
    const graph = computeGraph([c('A2', 'A1'), c('B1', 'A1'), c('A1')])
    expect(graph.rows.map((r) => r.column)).toEqual([0, 1, 0])
    expect(graph.rows[1].top).toEqual([{ from: 0, to: 0, color: 0 }])
    expect(graph.rows[2].top).toEqual([
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 0, color: 1 }
    ])
  })

  it('reutiliza los carriles que se liberan', () => {
    const graph = computeGraph([c('X1', 'X0'), c('X0'), c('Y1', 'Y0'), c('Y0')])
    expect(graph.rows.map((r) => r.column)).toEqual([0, 0, 0, 0])
    expect(graph.width).toBe(1)
    // Cada historia independiente recibe un color nuevo.
    expect(graph.rows[2].color).not.toBe(graph.rows[0].color)
  })

  it('un merge cuyo padre ya esperaba otro carril se une a ese carril', () => {
    // M mergea B1, que ya era esperado por la punta B2 en el carril 1
    const graph = computeGraph([c('B2', 'B1'), c('M', 'A1', 'B1'), c('B1', 'A1'), c('A1')])
    expect(graph.rows.map((r) => r.column)).toEqual([0, 1, 0, 0])
    expect(graph.rows[1].bottom).toContainEqual({ from: 1, to: 0, color: 0 })
  })
})
