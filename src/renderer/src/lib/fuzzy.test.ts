import { describe, expect, it } from 'vitest'
import { fuzzyFilter, fuzzyScore } from './fuzzy'

describe('fuzzyScore', () => {
  it('encuentra letras en orden, sin importar tildes ni mayúsculas', () => {
    expect(fuzzyScore('chk main', 'Checkout de main')).not.toBeNull()
    expect(fuzzyScore('accion', 'Acción rápida')).not.toBeNull()
    expect(fuzzyScore('xyz', 'Checkout de main')).toBeNull()
  })

  it('prefiere inicios de palabra y letras seguidas', () => {
    expect(fuzzyScore('pu', 'Push')!).toBeGreaterThan(fuzzyScore('pu', 'Copiar un SHA')!)
  })
})

describe('fuzzyFilter', () => {
  const commands = ['Push', 'Pull (rebase)', 'Pull (solo avance rápido)', 'Checkout de feature/pagos', 'Tema: Abismo']

  it('ordena por coincidencia', () => {
    expect(fuzzyFilter(commands, 'pull', (c) => c)[0]).toMatch(/^Pull/)
    expect(fuzzyFilter(commands, 'pagos', (c) => c)).toEqual(['Checkout de feature/pagos'])
  })

  it('sin búsqueda deja todo como estaba', () => {
    expect(fuzzyFilter(commands, '  ', (c) => c)).toEqual(commands)
  })
})
