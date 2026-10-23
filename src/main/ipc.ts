import { join, resolve } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell, type IpcMainInvokeEvent } from 'electron'
import {
  IPC,
  type ConfirmOptions,
  type FileSource,
  type IpcResult,
  type NativeAppearance,
  type PatchAction,
  type ProviderInfo,
  type WorkingArea,
  type WorkingFile
} from '../shared/types'
import { AvatarResolver } from './avatars'
import { branchesContaining, branchInsight } from './git/branches'
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

/** Repos vigilados: uno por pestaña abierta. */
const watchers = new Map<string, () => void>()

let avatars: AvatarResolver | null = null

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

  handle(IPC.branchInsight, (root: string, ref: string) => branchInsight(root, ref))
  handle(IPC.branchesContaining, (root: string, sha: string) => branchesContaining(root, sha))
  handle(IPC.resolveAvatars, async (_root: string, emails: string[], provider: ProviderInfo | null) => {
    avatars ??= new AvatarResolver(join(app.getPath('userData'), 'avatars.json'))
    return avatars.resolve(emails, provider)
  })

  handleWithEvent(IPC.setAppearance, async (event, appearance: NativeAppearance) => {
    // Los diálogos nativos y el menú contextual siguen el tema elegido en la app.
    nativeTheme.themeSource = appearance.theme
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window && process.platform === 'win32') window.setTitleBarOverlay({ ...appearance.titleBar, height: TITLE_BAR_HEIGHT })
  })

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
    if (watchers.has(root)) return
    const sender = event.sender
    if (watchers.size === 0) {
      // Al cerrar la ventana se dejan de vigilar todos los repos.
      sender.once('destroyed', () => {
        for (const stop of watchers.values()) stop()
        watchers.clear()
      })
    }
    watchers.set(
      root,
      watchRepo(root, (change) => {
        if (!sender.isDestroyed()) sender.send(IPC.repoChanged, root, change)
      })
    )
  })
  handle(IPC.unwatchRepo, async (root: string) => {
    watchers.get(root)?.()
    watchers.delete(root)
  })
}

/** Alto de la barra de título propia (las pestañas de repos viven ahí). */
export const TITLE_BAR_HEIGHT = 40
