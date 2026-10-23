import { describe, expect, it } from 'vitest'
import { describeMerge } from './merge'

describe('describeMerge', () => {
  it.each([
    ["Merge branch 'feature/login'", { from: 'feature/login', into: null, request: null }],
    ["Merge branch 'hotfix' into develop", { from: 'hotfix', into: 'develop', request: null }],
    ["Merge branch 'x' into 'main'", { from: 'x', into: 'main', request: null }],
    ["Merge branch 'main' of https://github.com/a/b into main", { from: 'main', into: 'main', request: null }],
    ["Merge remote-tracking branch 'origin/dev'", { from: 'origin/dev', into: null, request: null }],
    ['Merge pull request #42 from ana/feature/pagos', { from: 'feature/pagos', into: null, request: 42 }]
  ])('%s', (subject, expected) => {
    expect(describeMerge(subject)).toEqual(expected)
  })

  it('devuelve null si el mensaje no es de un merge conocido', () => {
    expect(describeMerge('Arregla el login')).toBeNull()
  })
})
