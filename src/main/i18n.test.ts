import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EN } from '../shared/i18n.en'
import { setLocale, t, tn } from '../shared/i18n'

/** Los textos que el código pasa a t('…'), tr('…') y tn(n, '…', '…'), sin contar los comentarios. */
function sourceKeys(): Map<string, string> {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.|i18n\.en\.ts$/.test(entry.name)) files.push(path)
    }
  }
  walk(join(__dirname, '..'))
  const literal = String.raw`'((?:[^'\\]|\\.)*)'`
  const patterns = [new RegExp(String.raw`\b(?:t|tr)\(\s*` + literal, 'g'), new RegExp(String.raw`\btn\([^,]+,\s*` + literal + String.raw`,\s*` + literal, 'g')]
  const unescape = (text: string) => text.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c))
  const keys = new Map<string, string>()
  for (const file of files) {
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    for (const pattern of patterns) for (const match of code.matchAll(pattern)) for (const key of match.slice(1)) keys.set(unescape(key), file)
  }
  return keys
}

const variables = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('traducciones', () => {
  const keys = sourceKeys()

  it('encuentra los textos del código', () => {
    expect(keys.size).toBeGreaterThan(500)
  })

  it('todos los textos tienen su traducción al inglés', () => {
    const missing = [...keys.keys()].filter((key) => !(key in EN))
    expect(missing).toEqual([])
  })

  it('cada traducción usa las mismas variables', () => {
    const wrong = Object.entries(EN).filter(([es, en]) => variables(es).join() !== variables(en).join())
    expect(wrong).toEqual([])
  })
})

describe('t y tn', () => {
  afterEach(() => setLocale('es'))

  it('en español devuelve el texto y completa las variables', () => {
    expect(t('Rama {name} creada.', { name: 'main' })).toBe('Rama main creada.')
  })

  it('en inglés traduce y deja el texto original si falta la clave', () => {
    setLocale('en')
    expect(t('Rama {name} creada.', { name: 'main' })).toBe('Branch main created.')
    expect(t('Texto sin traducir')).toBe('Texto sin traducir')
  })

  it('tn elige singular o plural y formatea el número', () => {
    expect(tn(1, '{n} archivo', '{n} archivos')).toBe('1 archivo')
    expect(tn(1500, '{n} archivo', '{n} archivos')).toBe('1.500 archivos')
    setLocale('en')
    expect(tn(1500, '{n} archivo', '{n} archivos')).toBe('1,500 files')
  })
})
