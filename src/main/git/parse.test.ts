import { describe, expect, it } from 'vitest'
import { looksBinary, parseCommitHeader, parseLog, parseNameStatus, parseNumstat, parseRefs, parseStatus } from './parse'

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
      'refs/heads/main\tmain\taaa\t',
      'refs/remotes/origin/HEAD\torigin\taaa\t',
      'refs/remotes/origin/feature\torigin/feature\tbbb\t',
      'refs/tags/v1.0\tv1.0\tccc\t',
      ''
    ].join('\n')
    expect(parseRefs(output)).toEqual([
      { ref: 'refs/heads/main', name: 'main', kind: 'local', target: 'aaa' },
      { ref: 'refs/remotes/origin/feature', name: 'origin/feature', kind: 'remote', target: 'bbb' },
      { ref: 'refs/tags/v1.0', name: 'v1.0', kind: 'tag', target: 'ccc' }
    ])
  })

  it('en los tags anotados usa el commit al que apunta el tag', () => {
    expect(parseRefs('refs/tags/v2\tv2\tobjeto-tag\tcommit-real\n')[0].target).toBe('commit-real')
  })
})

describe('parseLog', () => {
  it('lee un commit por línea, con padres y mensajes con caracteres raros', () => {
    const output = [
      ['c3', 'c2 f1', 'Ana Pérez', 'ana@example.com', '1700000300', 'Merge: rama "x" | y'].join('\x1f'),
      ['c1', '', 'Bo', 'bo@example.com', '1700000100', 'inicial\r'].join('\x1f'),
      ''
    ].join('\n')
    expect(parseLog(output)).toEqual([
      {
        sha: 'c3',
        parents: ['c2', 'f1'],
        authorName: 'Ana Pérez',
        authorEmail: 'ana@example.com',
        authorDate: 1700000300,
        subject: 'Merge: rama "x" | y'
      },
      { sha: 'c1', parents: [], authorName: 'Bo', authorEmail: 'bo@example.com', authorDate: 1700000100, subject: 'inicial' }
    ])
  })
})

describe('parseCommitHeader', () => {
  it('separa el resumen del mensaje completo', () => {
    const output = ['c2', 'c1', 'Ana', 'ana@x.com', '10', 'Bo', 'bo@x.com', '20', 'Resumen\r\n\r\nDetalle\nmás detalle\n\n'].join(
      '\x1f'
    )
    expect(parseCommitHeader(output)).toMatchObject({
      sha: 'c2',
      parents: ['c1'],
      committerName: 'Bo',
      committerDate: 20,
      subject: 'Resumen',
      message: 'Resumen\n\nDetalle\nmás detalle'
    })
  })
})

describe('looksBinary', () => {
  it('detecta bytes NUL', () => {
    expect(looksBinary(Buffer.from([0x89, 0x50, 0x00, 0x47]))).toBe(true)
    expect(looksBinary(Buffer.from('hola, mundo'))).toBe(false)
  })
})

describe('parseStatus', () => {
  it('lee conflictos, HEAD desacoplado y archivos modificados en los dos lados', () => {
    const output = [
      '# branch.oid abc123',
      '# branch.head (detached)',
      '1 MM N... 100644 100644 100644 h1 h2 con espacios.txt',
      'u UU N... 100644 100644 100644 100644 h1 h2 h3 en conflicto.txt',
      '? nuevo.txt',
      ''
    ].join('\0')
    expect(parseStatus(output)).toEqual({
      head: 'abc123',
      branch: null,
      staged: [{ path: 'con espacios.txt', status: 'modified' }],
      unstaged: [
        { path: 'con espacios.txt', status: 'modified' },
        { path: 'nuevo.txt', status: 'added', untracked: true }
      ],
      conflicted: [{ path: 'en conflicto.txt', status: 'modified' }]
    })
  })

  it('reconoce un repo sin commits', () => {
    expect(parseStatus('# branch.oid (initial)\0# branch.head main\0')).toMatchObject({ head: null, branch: 'main' })
  })
})
