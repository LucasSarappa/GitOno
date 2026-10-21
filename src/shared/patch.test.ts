import { describe, expect, it } from 'vitest'
import { buildPatch, parseFileDiff, wholeHunk } from './patch'

const HEADER = ['diff --git a/app.ts b/app.ts', 'index 1111111..2222222 100644', '--- a/app.ts', '+++ b/app.ts']

const DIFF = [
  ...HEADER,
  '@@ -1,4 +1,5 @@',
  ' uno',
  '-dos',
  '+DOS',
  '+dos y medio',
  ' tres',
  ' cuatro',
  '@@ -10,2 +11,2 @@ function fin()',
  ' diez',
  '-once',
  '\\ No newline at end of file',
  '+ONCE',
  '\\ No newline at end of file',
  ''
].join('\n')

describe('parseFileDiff', () => {
  it('lee el encabezado, los bloques y los números de línea', () => {
    const diff = parseFileDiff(DIFF)
    expect(diff.header).toEqual(HEADER)
    expect(diff.binary).toBe(false)
    expect(diff.hunks).toHaveLength(2)
    const [first, second] = diff.hunks
    expect(first.lines.map((l) => [l.kind, l.text, l.oldNumber, l.newNumber])).toEqual([
      ['context', 'uno', 1, 1],
      ['removed', 'dos', 2, null],
      ['added', 'DOS', null, 2],
      ['added', 'dos y medio', null, 3],
      ['context', 'tres', 3, 4],
      ['context', 'cuatro', 4, 5]
    ])
    expect(second.header).toBe('@@ -10,2 +11,2 @@ function fin()')
    expect(second.lines.map((l) => l.noNewline)).toEqual([false, true, true])
  })

  it('detecta archivos binarios', () => {
    const diff = parseFileDiff('diff --git a/x.png b/x.png\nindex 1..2 100644\nBinary files a/x.png and b/x.png differ\n')
    expect(diff.binary).toBe(true)
    expect(diff.hunks).toEqual([])
  })

  it('conserva el \\r de los archivos con CRLF', () => {
    const diff = parseFileDiff([...HEADER, '@@ -1 +1 @@', '-a\r', '+b\r', ''].join('\n'))
    expect(diff.hunks[0].lines.map((l) => l.text)).toEqual(['a\r', 'b\r'])
  })
})

describe('buildPatch', () => {
  const diff = parseFileDiff(DIFF)

  it('un bloque entero queda igual que en el diff original', () => {
    expect(buildPatch(diff, wholeHunk(0), 'forward')).toBe(
      [...HEADER, '@@ -1,4 +1,5 @@', ' uno', '-dos', '+DOS', '+dos y medio', ' tres', ' cuatro', ''].join('\n')
    )
  })

  it('preparar una sola línea agregada: las otras agregadas se descartan y las borradas quedan como contexto', () => {
    const onlyThird = (h: number, l: number) => h === 0 && l === 3 // "+dos y medio"
    expect(buildPatch(diff, onlyThird, 'forward')).toBe(
      [...HEADER, '@@ -1,4 +1,5 @@', ' uno', ' dos', '+dos y medio', ' tres', ' cuatro', ''].join('\n')
    )
  })

  it('al revés: las agregadas no elegidas quedan como contexto y las borradas no elegidas se descartan', () => {
    const onlyThird = (h: number, l: number) => h === 0 && l === 3
    expect(buildPatch(diff, onlyThird, 'reverse')).toBe(
      [...HEADER, '@@ -1,4 +1,5 @@', ' uno', ' DOS', '+dos y medio', ' tres', ' cuatro', ''].join('\n')
    )
  })

  it('mantiene la marca de "sin salto de línea al final"', () => {
    expect(buildPatch(diff, wholeHunk(1), 'forward')).toBe(
      [
        ...HEADER,
        '@@ -10,2 +11,2 @@',
        ' diez',
        '-once',
        '\\ No newline at end of file',
        '+ONCE',
        '\\ No newline at end of file',
        ''
      ].join('\n')
    )
  })

  it('devuelve null si no se eligió ningún cambio', () => {
    expect(buildPatch(diff, () => false, 'forward')).toBeNull()
  })
})
