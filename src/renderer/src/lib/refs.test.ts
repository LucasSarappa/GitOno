import { describe, expect, it } from 'vitest'
import type { RefInfo } from '../../../shared/types'
import { labelsByCommit, splitRemoteName } from './refs'

const ref = (kind: RefInfo['kind'], name: string, target: string): RefInfo => {
  const prefix = { local: 'refs/heads/', remote: 'refs/remotes/', tag: 'refs/tags/' }[kind]
  return { ref: prefix + name, name, kind, target }
}

describe('labelsByCommit', () => {
  it('junta la rama local con su remota cuando apuntan al mismo commit', () => {
    const labels = labelsByCommit(
      [ref('local', 'main', 'c1'), ref('remote', 'origin/main', 'c1'), ref('tag', 'v1', 'c1')],
      'refs/heads/main',
      'c1'
    )
    expect(labels.get('c1')).toEqual([
      { key: 'refs/heads/main', label: 'main', kind: 'local', current: true, remotes: ['origin'] },
      { key: 'refs/tags/v1', label: 'v1', kind: 'tag', current: false, remotes: [] }
    ])
  })

  it('muestra la remota aparte si está en otro commit', () => {
    const labels = labelsByCommit([ref('local', 'main', 'c2'), ref('remote', 'origin/main', 'c1')], 'refs/heads/main', 'c2')
    expect(labels.get('c1')?.map((l) => l.label)).toEqual(['origin/main'])
    expect(labels.get('c2')?.[0].remotes).toEqual([])
  })

  it('marca HEAD cuando está desacoplado', () => {
    const labels = labelsByCommit([ref('local', 'main', 'c2')], null, 'c1')
    expect(labels.get('c1')?.[0]).toMatchObject({ label: 'HEAD', kind: 'head', current: true })
  })
})

describe('splitRemoteName', () => {
  it('separa el remoto de ramas con barras', () => {
    expect(splitRemoteName('origin/feature/login')).toEqual({ remote: 'origin', branch: 'feature/login' })
  })
})
