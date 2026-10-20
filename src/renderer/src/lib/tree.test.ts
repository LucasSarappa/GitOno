import { describe, expect, it } from 'vitest'
import type { FileChange } from '../../../shared/types'
import { buildTree, visibleFiles, type FolderNode } from './tree'

const file = (path: string): FileChange => ({ status: 'modified', path, additions: 1, deletions: 0 })

describe('buildTree', () => {
  it('pone carpetas primero y compacta carpetas con un solo hijo', () => {
    const tree = buildTree([file('README.md'), file('src/main/git/repo.ts'), file('src/main/git/run.ts'), file('src/main/index.ts')])
    expect(tree.map((n) => n.name)).toEqual(['src/main', 'README.md'])
    const main = tree[0] as FolderNode
    expect(main.children.map((n) => n.name)).toEqual(['git', 'index.ts'])
  })

  it('ordena números de forma natural', () => {
    const tree = buildTree([file('paso10.md'), file('paso2.md'), file('paso1.md')])
    expect(tree.map((n) => n.name)).toEqual(['paso1.md', 'paso2.md', 'paso10.md'])
  })
})

describe('visibleFiles', () => {
  it('saltea los archivos de carpetas colapsadas', () => {
    const tree = buildTree([file('a/uno.ts'), file('b/dos.ts'), file('tres.ts')])
    expect(visibleFiles(tree, new Set(['a'])).map((f) => f.path)).toEqual(['b/dos.ts', 'tres.ts'])
  })
})
