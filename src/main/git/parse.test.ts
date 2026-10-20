import { describe, expect, it } from 'vitest'
import { looksBinary, parseNameStatus, parseNumstat, parseRefs } from './parse'

describe('parseNameStatus', () => {
  it('lee cambios simples, renombres y rutas con espacios', () => {
    const output = ['M', 'src/app.ts', 'A', 'docs/guía de uso.md', 'D', 'viejo.txt', 'R087', 'a.ts', 'b.ts', ''].join('\0')
    expect(parseNameStatus(output)).toEqual([
      { status: 'modified', path: 'src/app.ts' },
      { status: 'added', path: 'docs/guía de uso.md' },
      { status: 'deleted', path: 'viejo.txt' },
      { status: 'renamed', path: 'b.ts', oldPath: 'a.ts' }
    ])
  })

  it('devuelve una lista vacía si no hay diferencias', () => {
    expect(parseNameStatus('')).toEqual([])
  })
})

describe('parseNumstat', () => {
  it('lee líneas agregadas y borradas, binarios y renombres', () => {
    const output = ['3\t1\tsrc/app.ts', '-\t-\tlogo.png', '2\t0\t', 'a.ts', 'b.ts', ''].join('\0')
    const counts = parseNumstat(output)
    expect(counts.get('src/app.ts')).toEqual({ additions: 3, deletions: 1 })
    expect(counts.get('logo.png')).toEqual({ additions: null, deletions: null })
    expect(counts.get('b.ts')).toEqual({ additions: 2, deletions: 0 })
    expect(counts.has('a.ts')).toBe(false)
  })
})

describe('parseRefs', () => {
  it('clasifica ramas locales, remotas y tags, y descarta origin/HEAD', () => {
    const output = [
      'refs/heads/main\tmain',
      'refs/remotes/origin/HEAD\torigin',
      'refs/remotes/origin/feature\torigin/feature',
      'refs/tags/v1.0\tv1.0',
      ''
    ].join('\n')
    expect(parseRefs(output)).toEqual([
      { ref: 'refs/heads/main', name: 'main', kind: 'local' },
      { ref: 'refs/remotes/origin/feature', name: 'origin/feature', kind: 'remote' },
      { ref: 'refs/tags/v1.0', name: 'v1.0', kind: 'tag' }
    ])
  })
})

describe('looksBinary', () => {
  it('detecta bytes NUL', () => {
    expect(looksBinary(Buffer.from([0x89, 0x50, 0x00, 0x47]))).toBe(true)
    expect(looksBinary(Buffer.from('hola, mundo'))).toBe(false)
  })
})
