import { resolve } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC, type IpcResult } from '../shared/types'
import { compareRefs, fetchAll, listRefs, openRepo, readFileAtRef } from './git/repo'

/** Registra un handler que nunca rechaza: los errores viajan como `{ ok: false }` con un mensaje legible. */
function handle<Args extends unknown[], R>(channel: string, fn: (...args: Args) => Promise<R>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<R>> => {
    try {
      return { ok: true, value: await fn(...(args as Args)) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

/** Permite abrir la app directo en un repo: `electron . C:\ruta\al\repo`. */
function repoPathFromArgs(argv: string[]): string | null {
  const args = argv.slice(app.isPackaged ? 1 : 2).filter((arg) => !arg.startsWith('-'))
  const last = args.at(-1)
  return last ? resolve(last) : null
}

export function registerIpc(): void {
  handle(IPC.pickRepo, async () => {
    const window = BrowserWindow.getFocusedWindow()
    const options: Electron.OpenDialogOptions = { title: 'Abrir repositorio', properties: ['openDirectory'] }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return openRepo(result.filePaths[0])
  })
  handle(IPC.openRepo, (path: string) => openRepo(path))
  handle(IPC.initialRepoPath, async () => repoPathFromArgs(process.argv))
  handle(IPC.listRefs, (root: string) => listRefs(root))
  handle(IPC.fetchAll, (root: string) => fetchAll(root))
  handle(IPC.compare, (root: string, refA: string, refB: string) => compareRefs(root, refA, refB))
  handle(IPC.readFile, (root: string, ref: string, path: string) => readFileAtRef(root, ref, path))
}
