import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell, type IpcMainInvokeEvent } from 'electron'
import {
  IPC,
  type ConfirmOptions,
  type FileSource,
  type GitProgress,
  type GraphFilter,
  type OpenTarget,
  type IpcResult,
  type MergeMode,
  type NativeAppearance,
  type PatchAction,
  type ProviderInfo,
  type PullMode,
  type ResetMode,
  type WorkingArea,
  type WorkingFile
} from '../shared/types'
import { AvatarResolver } from './avatars'
import { branchesContaining, branchInsight } from './git/branches'
import * as ops from './git/ops'
import { commitDetails, compareRefs, fetchAll, listCommits, listRefs, openRepo, searchCode } from './git/repo'
import { openRepoIn } from './open'
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

/**
 * Manda el progreso de un comando a la ventana que lo pidió. Como mucho diez avisos por segundo
 * (Git escribe muchos más), salvo cuando cambia la fase o termina.
 */
function progressTo(event: IpcMainInvokeEvent, root: string): (progress: GitProgress) => void {
  let last = 0
  let lastPhase = ''
  return (progress) => {
    const now = Date.now()
    if (progress.phase === lastPhase && progress.percent < 100 && now - last < 100) return
    last = now
    lastPhase = progress.phase
    if (!event.sender.isDestroyed()) event.sender.send(IPC.progress, root, progress)
  }
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
  handleWithEvent(IPC.fetchAll, (event, root: string) => fetchAll(root, progressTo(event, root)))
  handle(IPC.searchCode, (root: string, text: string) => searchCode(root, String(text)))
  handle(IPC.openIn, (root: string, target: OpenTarget) => openRepoIn(root, target))
  handle(IPC.compare, (root: string, refA: string, refB: string) => compareRefs(root, refA, refB))
  handle(IPC.readFile, (root: string, source: FileSource, path: string) => readSource(root, source, path))
  handle(IPC.listCommits, (root: string, limit: number, filter?: GraphFilter) => listCommits(root, limit, filter))
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

  handle(IPC.checkout, (root: string, target: string) => ops.checkout(root, target))
  handle(IPC.createBranch, (root: string, name: string, start: string, checkout: boolean) => ops.createBranch(root, name, start, checkout))
  handle(IPC.renameBranch, (root: string, ref: string, name: string) => ops.renameBranch(root, ref, name))
  handle(IPC.deleteBranch, (root: string, ref: string, force: boolean) => ops.deleteBranch(root, ref, force))
  handle(IPC.deleteRemoteBranch, (root: string, ref: string) => ops.deleteRemoteBranch(root, ref))
  handle(IPC.setUpstream, (root: string, ref: string, upstream: string | null) => ops.setUpstream(root, ref, upstream))
  handle(IPC.fastForward, (root: string, ref: string, to: string) => ops.fastForward(root, ref, to))
  handle(IPC.merge, (root: string, ref: string, mode: MergeMode) => ops.merge(root, ref, mode))
  handle(IPC.rebase, (root: string, onto: string) => ops.rebase(root, onto))
  handle(IPC.cherryPick, (root: string, sha: string) => ops.cherryPick(root, sha))
  handle(IPC.revert, (root: string, sha: string) => ops.revert(root, sha))
  handle(IPC.reset, (root: string, sha: string, mode: ResetMode) => ops.reset(root, sha, mode))
  handle(IPC.continueOperation, (root: string) => ops.continueOperation(root))
  handle(IPC.abortOperation, (root: string) => ops.abortOperation(root))
  handle(IPC.createTag, (root: string, name: string, sha: string, message: string | null) => ops.createTag(root, name, sha, message))
  handle(IPC.deleteTag, (root: string, ref: string) => ops.deleteTag(root, ref))
  handle(IPC.pushTag, (root: string, ref: string, remote: string) => ops.pushTag(root, ref, remote))
  handle(IPC.deleteRemoteTag, (root: string, ref: string, remote: string) => ops.deleteRemoteTag(root, ref, remote))
  handle(IPC.listRemotes, (root: string) => ops.listRemotes(root))
  handleWithEvent(IPC.pull, (event, root: string, mode: PullMode) => ops.pull(root, mode, progressTo(event, root)))
  handleWithEvent(IPC.push, (event, root: string, ref: string, force: boolean) => ops.push(root, ref, force, progressTo(event, root)))
  handle(IPC.listStashes, (root: string) => ops.listStashes(root))
  handle(IPC.stash, (root: string, message: string) => ops.stash(root, message))
  handle(IPC.applyStash, (root: string, index: number, pop: boolean) => ops.applyStash(root, index, pop))
  handle(IPC.dropStash, (root: string, index: number) => ops.dropStash(root, index))
  handle(IPC.restoreStash, (root: string, sha: string, message: string) => ops.restoreStash(root, sha, message))
  handle(IPC.renameStash, (root: string, index: number, message: string) => ops.renameStash(root, index, message))

  handleWithEvent(IPC.savePatch, async (event, root: string, sha: string) => {
    const { name, patch } = await ops.formatPatch(root, sha)
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.SaveDialogOptions = {
      title: 'Guardar parche',
      defaultPath: join(app.getPath('downloads'), name),
      filters: [{ name: 'Parche de Git', extensions: ['patch'] }]
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, patch)
    return true
  })
  handle(IPC.copyText, async (text: string) => clipboard.writeText(String(text)))
  handle(IPC.openExternal, async (url: string) => {
    // Solo direcciones web: nunca archivos ni otros protocolos que pudieran ejecutar algo.
    if (!/^https:\/\//i.test(url)) throw new Error('Solo se pueden abrir direcciones https.')
    await shell.openExternal(url)
  })
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
