// Diff unificado: lectura y armado de parches con solo los bloques o líneas elegidas.
// Es lo que permite preparar, quitar o descartar partes de un archivo, como en GitKraken.

export type DiffLineKind = 'context' | 'added' | 'removed'

export interface DiffLine {
  kind: DiffLineKind
  /** Contenido sin el prefijo (+, - o espacio). Conserva el \r final si el archivo usa CRLF. */
  text: string
  oldNumber: number | null
  newNumber: number | null
  /** La línea no termina con salto de línea ("\ No newline at end of file"). */
  noNewline: boolean
}

export interface Hunk {
  /** Encabezado tal como lo escribió Git, ej. "@@ -10,4 +10,6 @@ function main()". */
  header: string
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

export interface FileDiff {
  /** Encabezado del archivo (diff --git, index, ---, +++). Se copia tal cual en cada parche. */
  header: string[]
  hunks: Hunk[]
  binary: boolean
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/** Lee la salida de `git diff` para un solo archivo. */
export function parseFileDiff(text: string): FileDiff {
  const diff: FileDiff = { header: [], hunks: [], binary: false }
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()

  let hunk: Hunk | null = null
  let oldNumber = 0
  let newNumber = 0
  for (const line of lines) {
    const match = HUNK_HEADER.exec(line)
    if (match) {
      oldNumber = Number(match[1])
      newNumber = Number(match[2])
      hunk = { header: line, oldStart: oldNumber, newStart: newNumber, lines: [] }
      diff.hunks.push(hunk)
      continue
    }
    if (!hunk) {
      diff.header.push(line)
      if (line.startsWith('Binary files ') || line === 'GIT binary patch') diff.binary = true
      continue
    }
    if (line.startsWith('\\')) {
      const previous = hunk.lines[hunk.lines.length - 1]
      if (previous) previous.noNewline = true
      continue
    }
    const text = line.slice(1)
    if (line.startsWith('+')) {
      hunk.lines.push({ kind: 'added', text, oldNumber: null, newNumber: newNumber++, noNewline: false })
    } else if (line.startsWith('-')) {
      hunk.lines.push({ kind: 'removed', text, oldNumber: oldNumber++, newNumber: null, noNewline: false })
    } else {
      hunk.lines.push({ kind: 'context', text, oldNumber: oldNumber++, newNumber: newNumber++, noNewline: false })
    }
  }
  return diff
}

/** Indica si la línea `line` del bloque `hunk` (una línea + o -) está elegida. */
export type LineSelection = (hunk: number, line: number) => boolean

/**
 * Arma un parche con solo las líneas elegidas.
 *
 * - `forward` (para aplicar tal cual, al preparar): una línea agregada que no se eligió se
 *   descarta, y una borrada que no se eligió pasa a ser contexto (sigue estando).
 * - `reverse` (para aplicar al revés, al quitar del índice o descartar): al revés. Una agregada
 *   que no se eligió pasa a ser contexto, y una borrada que no se eligió se descarta.
 *
 * Los números de los encabezados se recalculan, pero igual conviene aplicar con `--recount`.
 * Devuelve null si no hay ningún cambio elegido.
 */
export function buildPatch(diff: FileDiff, isSelected: LineSelection, direction: 'forward' | 'reverse'): string | null {
  const output = [...diff.header]
  let hasChanges = false

  diff.hunks.forEach((hunk, h) => {
    const body: string[] = []
    let oldCount = 0
    let newCount = 0
    let changes = 0

    hunk.lines.forEach((line, l) => {
      let prefix: ' ' | '+' | '-' | null
      if (line.kind === 'context') prefix = ' '
      else if (isSelected(h, l)) {
        prefix = line.kind === 'added' ? '+' : '-'
        changes++
      } else if ((line.kind === 'removed') === (direction === 'forward')) prefix = ' '
      else prefix = null

      if (prefix === null) return
      if (prefix !== '+') oldCount++
      if (prefix !== '-') newCount++
      body.push(prefix + line.text)
      if (line.noNewline) body.push('\\ No newline at end of file')
    })

    if (changes === 0) return
    hasChanges = true
    output.push(`@@ -${hunk.oldStart},${oldCount} +${hunk.newStart},${newCount} @@`, ...body)
  })

  return hasChanges ? output.join('\n') + '\n' : null
}

/** Selección de un bloque entero. */
export const wholeHunk =
  (hunkIndex: number): LineSelection =>
  (h) =>
    h === hunkIndex
