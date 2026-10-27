// Contra un repo real y una configuración global de prueba (GIT_CONFIG_GLOBAL), sin tocar la del usuario.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readIdentity, writeIdentity } from './identity'

let dir: string
let previousGlobal: string | undefined

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gitono-identity-'))
  previousGlobal = process.env.GIT_CONFIG_GLOBAL
  const globalConfig = join(dir, 'global.gitconfig')
  writeFileSync(globalConfig, '[user]\n\tname = Ana Global\n\temail = ana@casa.com\n')
  process.env.GIT_CONFIG_GLOBAL = globalConfig
  execFileSync('git', ['init', '-q', join(dir, 'repo')])
})

afterEach(() => {
  if (previousGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL
  else process.env.GIT_CONFIG_GLOBAL = previousGlobal
  rmSync(dir, { recursive: true, force: true })
})

describe('identidad de Git', () => {
  it('lee la global y la del repo, que empieza vacía', async () => {
    expect(await readIdentity(join(dir, 'repo'))).toEqual({ global: { name: 'Ana Global', email: 'ana@casa.com' }, local: null })
  })

  it('cambia la del repo sin tocar la global, y la quita para volver a la global', async () => {
    const repo = join(dir, 'repo')
    await writeIdentity(repo, { name: ' Ana Facultad ', email: 'ana@facu.edu.ar' })
    expect(await readIdentity(repo)).toEqual({
      global: { name: 'Ana Global', email: 'ana@casa.com' },
      local: { name: 'Ana Facultad', email: 'ana@facu.edu.ar' }
    })
    await writeIdentity(repo, null)
    expect((await readIdentity(repo)).local).toBeNull()
  })

  it('cambia la global', async () => {
    await writeIdentity(null, { name: 'Ana Trabajo', email: 'ana@empresa.com' })
    expect((await readIdentity(null)).global).toEqual({ name: 'Ana Trabajo', email: 'ana@empresa.com' })
  })

  it('rechaza datos que no sirven', async () => {
    const repo = join(dir, 'repo')
    await expect(writeIdentity(repo, { name: '', email: 'a@b.c' })).rejects.toThrow()
    await expect(writeIdentity(repo, { name: 'Ana', email: 'no es un email' })).rejects.toThrow()
    await expect(writeIdentity(repo, { name: 'Ana\n[core]', email: 'a@b.c' })).rejects.toThrow()
  })
})
