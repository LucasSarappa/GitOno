// Abrir la carpeta del repo en el explorador, en una terminal o en VS Code. Cada sistema tiene su
// forma; si el programa no está, se avisa con un mensaje claro.

import { spawn } from 'node:child_process'
import { shell } from 'electron'
import type { OpenTarget } from '../shared/types'
import { openRepo } from './git/repo'

/** Lanza un programa suelto (sigue abierto aunque se cierre GitOno). Falla si no existe. */
function launch(command: string, args: string[], options: { cwd?: string; shell?: boolean } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, shell: options.shell, detached: true, stdio: 'ignore', windowsHide: false })
    child.once('error', reject)
    // Si arrancó, no hay que esperar a que termine.
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

async function openTerminal(root: string): Promise<void> {
  if (process.platform === 'win32') {
    // Windows Terminal si está; si no, la consola clásica.
    try {
      await launch('wt.exe', ['-d', root])
    } catch {
      await launch('cmd.exe', ['/c', 'start', 'cmd.exe', '/K'], { cwd: root })
    }
    return
  }
  if (process.platform === 'darwin') {
    await launch('open', ['-a', 'Terminal', root])
    return
  }
  // Linux: la terminal que eligió el sistema, o las más comunes.
  for (const terminal of ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm']) {
    try {
      await launch(terminal, [], { cwd: root })
      return
    } catch {
      // probar la siguiente
    }
  }
  throw new Error('No se encontró ninguna terminal para abrir.')
}

async function openEditor(root: string): Promise<void> {
  try {
    // En Windows "code" es un .cmd: hace falta la consola para ejecutarlo. La ruta va entre comillas
    // (en Windows una ruta no puede tener comillas, así que no se puede escapar de ellas).
    if (process.platform === 'win32') await launch('code', [`"${root}"`], { shell: true })
    else await launch('code', [root])
  } catch {
    throw new Error('No se encontró VS Code: instalalo y activá el comando "code" (en VS Code: "Shell Command: Install \'code\' command in PATH").')
  }
}

export async function openRepoIn(path: string, target: OpenTarget): Promise<void> {
  // Solo carpetas que son la raíz de un repo (lo confirma Git), y sin comillas: la ruta se le pasa a
  // la consola en Windows.
  const { root } = await openRepo(path)
  if (root.includes('"')) throw new Error('La ruta del repo tiene comillas: no se puede abrir desde acá.')
  if (target === 'folder') {
    const error = await shell.openPath(root)
    if (error) throw new Error(`No se pudo abrir la carpeta: ${error}`)
  } else if (target === 'terminal') {
    await openTerminal(root)
  } else {
    await openEditor(root)
  }
}
