// Vigila la carpeta del repo y avisa cuando algo cambia, para refrescar la app sola.

import { watch } from 'node:fs'
import type { RepoChange } from '../../shared/types'

/** Archivos dentro de .git que indican que cambiaron ramas, tags o HEAD. */
const REF_FILES = new Set(['HEAD', 'packed-refs', 'FETCH_HEAD', 'ORIG_HEAD', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'])

/** Qué tipo de cambio representa un archivo modificado (ruta relativa al repo), o null si no importa. */
export function classifyChange(relativePath: string): RepoChange | null {
  const path = relativePath.replace(/\\/g, '/')
  if (path !== '.git' && !path.startsWith('.git/')) return 'worktree'
  const inner = path.slice('.git/'.length)
  // Los .lock son temporales de Git mientras escribe; el cambio real llega cuando los renombra.
  if (!inner || inner.endsWith('.lock')) return null
  if (inner === 'index') return 'worktree'
  if (REF_FILES.has(inner) || inner.startsWith('refs/')) return 'refs'
  // Un rebase a medio hacer, o un stash borrado (si no es el último, solo cambia su historial).
  if (inner.startsWith('rebase-merge') || inner.startsWith('rebase-apply') || inner === 'logs/refs/stash') return 'refs'
  return null // objects/, el resto de logs/, config, etc.
}

/** Tiempo para juntar una ráfaga de cambios (ej. un `npm install`) en un solo aviso. */
const GROUP_MS = 300

/** Empieza a vigilar y devuelve una función para dejar de hacerlo. */
export function watchRepo(root: string, onChange: (change: RepoChange) => void): () => void {
  let pending: RepoChange | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = (change: RepoChange) => {
    // "refs" implica refrescar todo, así que tiene prioridad sobre "worktree".
    if (pending !== 'refs') pending = change
    // El aviso sale a los 300 ms del primer cambio de la ráfaga, aunque sigan llegando más:
    // durante un cambio largo la app se sigue actualizando cada tanto.
    timer ??= setTimeout(() => {
      const change = pending!
      pending = null
      timer = undefined
      onChange(change)
    }, GROUP_MS)
  }

  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    // Sin nombre de archivo no se sabe qué cambió: por las dudas se refresca todo.
    const change = filename ? classifyChange(filename.toString()) : 'refs'
    if (change) schedule(change)
  })
  // Si la carpeta deja de existir, simplemente se deja de vigilar.
  watcher.on('error', () => watcher.close())

  return () => {
    clearTimeout(timer)
    watcher.close()
  }
}
