import { describe, expect, it } from 'vitest'
import { parseProgress, progressReader } from './progress'
import type { GitProgress } from '../../shared/types'

describe('parseProgress', () => {
  it('traduce las fases de Git y su porcentaje', () => {
    expect(parseProgress('Receiving objects:  45% (9/20), 1.2 MiB | 3.4 MiB/s')).toEqual({ phase: 'Recibiendo objetos', percent: 45 })
    expect(parseProgress('remote: Compressing objects: 100% (3/3), done.')).toEqual({ phase: 'Comprimiendo objetos', percent: 100 })
    expect(parseProgress('Writing objects:   7% (1/14)')).toEqual({ phase: 'Enviando objetos', percent: 7 })
  })

  it('ignora lo que no es progreso', () => {
    expect(parseProgress('From github.com:ana/tienda')).toBeNull()
    expect(parseProgress(' * [new branch]      feature -> origin/feature')).toBeNull()
    expect(parseProgress('Algo raro: 50%')).toBeNull()
  })
})

describe('progressReader', () => {
  it('arma las líneas aunque lleguen cortadas y separadas por \\r', () => {
    const seen: GitProgress[] = []
    const read = progressReader((p) => seen.push(p))
    read('Receiving obj')
    read('ects:  10% (1/10)\rReceiving objects:  50% (5/10)\r')
    read('Resolving deltas: 100% (2/2), done.\n')
    expect(seen.map((p) => p.percent)).toEqual([10, 50, 100])
    expect(seen[2].phase).toBe('Resolviendo diferencias')
  })
})
