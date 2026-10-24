// Progreso de fetch, pull y push: Git lo escribe en stderr ("Receiving objects:  45% (9/20)")
// cuando se le pasa --progress. Acá se traduce a algo que la interfaz pueda mostrar.

import type { GitProgress } from '../../shared/types'

const PHASES: Record<string, string> = {
  'Enumerating objects': 'Enumerando objetos',
  'Counting objects': 'Contando objetos',
  'Compressing objects': 'Comprimiendo objetos',
  'Receiving objects': 'Recibiendo objetos',
  'Resolving deltas': 'Resolviendo diferencias',
  'Writing objects': 'Enviando objetos',
  'Updating files': 'Actualizando archivos',
  'Checking out files': 'Actualizando archivos',
  'Unpacking objects': 'Desempaquetando objetos'
}

/** Lee una línea de progreso de Git. Devuelve null si no es una (avisos, "From github.com:…", etc.). */
export function parseProgress(line: string): GitProgress | null {
  const match = /^(?:remote:\s*)?([A-Za-z ]+):\s+(\d{1,3})%/.exec(line.trim())
  if (!match) return null
  const phase = PHASES[match[1].trim()]
  if (!phase) return null
  return { phase, percent: Math.min(100, Number(match[2])) }
}

/**
 * Junta los pedazos de stderr y avisa cada vez que aparece una línea de progreso. Git separa las
 * actualizaciones de una misma línea con "\r", así que se parte por "\r" y por "\n".
 */
export function progressReader(onProgress: (progress: GitProgress) => void): (chunk: Buffer | string) => void {
  let pending = ''
  return (chunk) => {
    pending += chunk.toString()
    const parts = pending.split(/[\r\n]/)
    pending = parts.pop() ?? ''
    for (const part of parts) {
      const progress = parseProgress(part)
      if (progress) onProgress(progress)
    }
  }
}
