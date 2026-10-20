// Prueba de punta a punta del núcleo Git contra un repositorio real creado en una carpeta temporal.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compareRefs, listRefs, openRepo, readFileAtRef } from './repo'

let dir: string

function sh(...args: string[]): void {
  execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gitono-test-'))
  sh('init', '-q', '-b', 'main')
  sh('config', 'user.name', 'Test')
  sh('config', 'user.email', 'test@example.com')
  sh('config', 'commit.gpgsign', 'false')
  sh('remote', 'add', 'origin', 'git@gitlab.com:grupo/demo.git')

  writeFileSync(join(dir, 'README.md'), '# Demo\n')
  writeFileSync(join(dir, 'app.ts'), 'export const version = 1\n')
  writeFileSync(join(dir, 'viejo.txt'), 'se va a borrar\n')
  writeFileSync(join(dir, 'nombre-anterior.ts'), 'export function saludo() {\n  return "hola"\n}\n')
  sh('add', '.')
  sh('commit', '-q', '-m', 'inicial')

  sh('checkout', '-q', '-b', 'feature')
  writeFileSync(join(dir, 'app.ts'), 'export const version = 2\nexport const nuevo = true\n')
  writeFileSync(join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]))
  sh('rm', '-q', 'viejo.txt')
  sh('mv', 'nombre-anterior.ts', 'nombre-nuevo.ts')
  sh('add', '.')
  sh('commit', '-q', '-m', 'cambios en feature')
  sh('checkout', '-q', 'main')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('núcleo Git', () => {
  it('abre el repo y detecta la plataforma del remoto', async () => {
    const repo = await openRepo(dir)
    expect(repo.provider).toMatchObject({ id: 'gitlab', repoPath: 'grupo/demo' })
  })

  it('rechaza carpetas que no son repos', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'gitono-empty-'))
    try {
      await expect(openRepo(empty)).rejects.toThrow('no es un repositorio Git')
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  it('lista las ramas y la rama actual', async () => {
    const refs = await listRefs(dir)
    expect(refs.current).toBe('refs/heads/main')
    expect(refs.refs.map((r) => r.name).sort()).toEqual(['feature', 'main'])
  })

  it('compara dos ramas sin cambiar de rama', async () => {
    const result = await compareRefs(dir, 'refs/heads/main', 'refs/heads/feature')
    expect(result.files).toEqual([
      { status: 'modified', path: 'app.ts', additions: 2, deletions: 1 },
      { status: 'added', path: 'logo.png', additions: null, deletions: null },
      { status: 'renamed', path: 'nombre-nuevo.ts', oldPath: 'nombre-anterior.ts', additions: 0, deletions: 0 },
      { status: 'deleted', path: 'viejo.txt', additions: 0, deletions: 1 }
    ])
    expect(result.commitsOnlyInA).toBe(0)
    expect(result.commitsOnlyInB).toBe(1)
    expect((await listRefs(dir)).current).toBe('refs/heads/main')
  })

  it('lee archivos de cualquier rama: texto, binario e inexistente', async () => {
    expect(await readFileAtRef(dir, 'refs/heads/feature', 'app.ts')).toEqual({
      kind: 'text',
      text: 'export const version = 2\nexport const nuevo = true\n'
    })
    expect(await readFileAtRef(dir, 'refs/heads/main', 'app.ts')).toEqual({
      kind: 'text',
      text: 'export const version = 1\n'
    })
    expect(await readFileAtRef(dir, 'refs/heads/feature', 'logo.png')).toEqual({ kind: 'binary' })
    expect(await readFileAtRef(dir, 'refs/heads/main', 'logo.png')).toEqual({ kind: 'missing' })
  })

  it('no acepta referencias que parezcan opciones de Git', async () => {
    await expect(compareRefs(dir, '--output=x', 'refs/heads/main')).rejects.toThrow('Referencia inválida')
  })
})
