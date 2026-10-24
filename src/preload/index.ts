import { contextBridge, ipcRenderer, webFrame, type IpcRendererEvent } from 'electron'
import { IPC, type GitOnoApi, type GitProgress, type IpcResult, type RepoChange } from '../shared/types'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) throw new Error(result.error)
  return result.value
}

const api: GitOnoApi = {
  pickRepo: () => call(IPC.pickRepo),
  openRepo: (path) => call(IPC.openRepo, path),
  initialRepoPath: () => call(IPC.initialRepoPath),
  listRefs: (root) => call(IPC.listRefs, root),
  fetchAll: (root) => call(IPC.fetchAll, root),
  searchCode: (root, text) => call(IPC.searchCode, root, text),
  openIn: (root, target) => call(IPC.openIn, root, target),
  onProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, root: string, progress: GitProgress) => listener(root, progress)
    ipcRenderer.on(IPC.progress, handler)
    return () => ipcRenderer.removeListener(IPC.progress, handler)
  },
  compare: (root, refA, refB) => call(IPC.compare, root, refA, refB),
  readFile: (root, source, path) => call(IPC.readFile, root, source, path),
  listCommits: (root, limit, filter) => call(IPC.listCommits, root, limit, filter),
  commitDetails: (root, sha) => call(IPC.commitDetails, root, sha),

  workingStatus: (root) => call(IPC.workingStatus, root),
  workingDiff: (root, path, area) => call(IPC.workingDiff, root, path, area),
  stageFiles: (root, paths) => call(IPC.stageFiles, root, paths),
  unstageFiles: (root, paths) => call(IPC.unstageFiles, root, paths),
  discardFiles: (root, files) => call(IPC.discardFiles, root, files),
  applyPatch: (root, patch, action) => call(IPC.applyPatch, root, patch, action),
  commit: (root, message, amend) => call(IPC.commit, root, message, amend),
  lastCommitMessage: (root) => call(IPC.lastCommitMessage, root),

  branchInsight: (root, ref) => call(IPC.branchInsight, root, ref),
  branchesContaining: (root, sha) => call(IPC.branchesContaining, root, sha),

  checkout: (root, target) => call(IPC.checkout, root, target),
  createBranch: (root, name, start, checkout) => call(IPC.createBranch, root, name, start, checkout),
  renameBranch: (root, ref, name) => call(IPC.renameBranch, root, ref, name),
  deleteBranch: (root, ref, force) => call(IPC.deleteBranch, root, ref, force),
  deleteRemoteBranch: (root, ref) => call(IPC.deleteRemoteBranch, root, ref),
  setUpstream: (root, ref, upstream) => call(IPC.setUpstream, root, ref, upstream),
  fastForward: (root, ref, to) => call(IPC.fastForward, root, ref, to),
  merge: (root, ref, mode) => call(IPC.merge, root, ref, mode),
  rebase: (root, onto) => call(IPC.rebase, root, onto),
  cherryPick: (root, sha) => call(IPC.cherryPick, root, sha),
  revert: (root, sha) => call(IPC.revert, root, sha),
  reset: (root, sha, mode) => call(IPC.reset, root, sha, mode),
  continueOperation: (root) => call(IPC.continueOperation, root),
  abortOperation: (root) => call(IPC.abortOperation, root),
  createTag: (root, name, sha, message) => call(IPC.createTag, root, name, sha, message),
  deleteTag: (root, ref) => call(IPC.deleteTag, root, ref),
  pushTag: (root, ref, remote) => call(IPC.pushTag, root, ref, remote),
  deleteRemoteTag: (root, ref, remote) => call(IPC.deleteRemoteTag, root, ref, remote),
  listRemotes: (root) => call(IPC.listRemotes, root),
  pull: (root, mode) => call(IPC.pull, root, mode),
  push: (root, ref, force) => call(IPC.push, root, ref, force),

  listStashes: (root) => call(IPC.listStashes, root),
  stash: (root, message) => call(IPC.stash, root, message),
  applyStash: (root, index, pop) => call(IPC.applyStash, root, index, pop),
  dropStash: (root, index) => call(IPC.dropStash, root, index),
  restoreStash: (root, sha, message) => call(IPC.restoreStash, root, sha, message),
  renameStash: (root, index, message) => call(IPC.renameStash, root, index, message),

  savePatch: (root, sha) => call(IPC.savePatch, root, sha),
  copyText: (text) => call(IPC.copyText, text),
  openExternal: (url) => call(IPC.openExternal, url),
  resolveAvatars: (root, emails, provider) => call(IPC.resolveAvatars, root, emails, provider),

  confirm: (options) => call(IPC.confirm, options),
  watchRepo: (root) => call(IPC.watchRepo, root),
  unwatchRepo: (root) => call(IPC.unwatchRepo, root),
  onRepoChanged: (listener) => {
    const handler = (_event: IpcRendererEvent, root: string, change: RepoChange) => listener(root, change)
    ipcRenderer.on(IPC.repoChanged, handler)
    return () => ipcRenderer.removeListener(IPC.repoChanged, handler)
  },

  platform: process.platform,
  setAppearance: (appearance) => call(IPC.setAppearance, appearance),
  setZoom: (factor) => {
    // Entre 50 % y 300 %: un valor guardado roto no puede dejar la app ilegible.
    if (Number.isFinite(factor)) webFrame.setZoomFactor(Math.min(3, Math.max(0.5, factor)))
  }
}

contextBridge.exposeInMainWorld('gitono', api)
