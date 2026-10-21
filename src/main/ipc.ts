import { resolve } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { IPC, type ConfirmOptions, type FileSource, type IpcResult, type PatchAction, type WorkingArea, type WorkingFile } from '../shared/types'
import { commitDetails, compareRefs, fetchAll, listCommits, listRefs, openRepo } from './git/repo'
import { watchRepo } from './git/watch'
import {
  applyPatch,
  commit,
  insideRepo,
  lastCommitMessage,
  readSource,
  restoreWorktree,
  stageFiles,
  unstageFiles,
  workingDiff,
  workingStatus
} from './git/worktree'

/** Registra un handler que nunca rechaza: los errores viajan como `{ ok: false }` con un mensaje legible. */
function handleWithEvent<Args extends unknown[], R>(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: Args) => Promise<R>
): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<R>> => {
    try {
      return { ok: true, value: await fn(event, ...(args as Args)) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

function handle<Args extends unknown[], R>(channel: string, fn: (...args: Args) => Promise<R>): void {
  handleWithEvent(channel, (_event, ...args: Args) => fn(...args))
}

/** Permite abrir la app directo en un repo: `electron . C:\ruta\al\repo`. */
function repoPathFromArgs(argv: string[]): string | null {
  const args = argv.slice(app.isPackaged ? 1 : 2).filter((arg) => !arg.startsWith('-'))
  const last = args.at(-1)
  return last ? resolve(last) : null
}

/** Se vigila un solo repo a la vez: el que está abierto. */
let stopWatching: (() => void) | null = null

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
  handle(IPC.readFile, (root: string, source: FileSource, path: string) => readSource(root, source, path))
  handle(IPC.listCommits, (root: string, limit: number) => listCommits(root, limit))
  handle(IPC.commitDetails, (root: string, sha: string) => commitDetails(root, sha))

  handle(IPC.workingStatus, (root: string) => workingStatus(root))
  handle(IPC.workingDiff, (root: string, path: string, area: WorkingArea) => workingDiff(root, path, area))
  handle(IPC.stageFiles, (root: string, paths: string[]) => stageFiles(root, paths))
  handle(IPC.unstageFiles, (root: string, paths: string[]) => unstageFiles(root, paths))
  handle(IPC.discardFiles, async (root: string, files: WorkingFile[]) => {
    await restoreWorktree(
      root,
      files.filter((f) => !f.untracked).map((f) => f.path)
    )
    // Los archivos nuevos no están en Git: van a la papelera, así se pueden recuperar.
    for (const file of files.filter((f) => f.untracked)) await shell.trashItem(insideRepo(root, file.path))
  })
  handle(IPC.applyPatch, (root: string, patch: string, action: PatchAction) => applyPatch(root, patch, action))
  handle(IPC.commit, (root: string, message: string, amend: boolean) => commit(root, message, amend))
  handle(IPC.lastCommitMessage, (root: string) => lastCommitMessage(root))

  handleWithEvent(IPC.confirm, async (event, options: ConfirmOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const box: Electron.MessageBoxOptions = {
      type: 'warning',
      title: options.title,
      message: options.message,
      detail: options.detail,
      buttons: [options.confirmLabel, 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    }
    const { response } = window ? await dialog.showMessageBox(window, box) : await dialog.showMessageBox(box)
    return response === 0
  })

  handleWithEvent(IPC.watchRepo, async (event, root: string) => {
    stopWatching?.()
    const sender = event.sender
    stopWatching = watchRepo(root, (change) => {
      if (!sender.isDestroyed()) sender.send(IPC.repoChanged, change)
    })
    sender.once('destroyed', () => stopWatching?.())
  })
}
