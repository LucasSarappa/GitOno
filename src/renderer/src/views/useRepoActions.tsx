// Operaciones del repo desde la interfaz: menús de clic derecho (ramas, tags, commits, cambios,
// stashes, arrastrar una rama sobre otra), botones de la barra y Deshacer / Rehacer.

import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowUpFromLine,
  Cherry,
  Copy,
  Crosshair,
  ExternalLink,
  Eye,
  EyeOff,
  FastForward,
  FileDown,
  Focus,
  GitBranchPlus,
  GitCommitHorizontal,
  GitCompareArrows,
  GitMerge,
  GitPullRequestCreateArrow,
  Link,
  ListRestart,
  LogIn,
  PackageOpen,
  Pencil,
  RotateCcw,
  Tag,
  Trash,
  Upload
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CommitInfo,
  GraphFilter,
  MergeMode,
  Outcome,
  PullMode,
  RefInfo,
  RefList,
  RepoInfo,
  ResetMode,
  StashInfo,
  WorkingTreeStatus,
  GitProgress,
  OpenTarget
} from '../../../shared/types'
import { api } from '../api'
import { tidy, type MenuEntry, type MenuItem } from '../components/ContextMenu'
import { useDialog, type DialogOptions, type DialogValues } from '../components/Dialog'
import { shortSha } from '../lib/format'
import { webLinks } from '../lib/links'
import { splitRemoteName } from '../lib/refs'
import { loadSetting, saveSetting } from '../lib/settings'
import { UndoStack, type UndoEntry } from '../lib/undo'
import { t } from '../../../shared/i18n'

export interface Toast {
  id: number
  message: string
  /** Muestra el botón Deshacer (la operación quedó en el historial). */
  undoable: boolean
}

/** Lo que devuelve una operación al terminar: el aviso a mostrar y cómo deshacerla. */
interface Result {
  message?: string
  undo?: UndoEntry
}

/** Nombre corto: "main", "origin/main", "v1.0". */
export const shortRef = (ref: string) => ref.replace(/^refs\/(heads|remotes|tags)\//, '')
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Mensajes de Git (o de git/ops.ts) que piden una respuesta distinta a "mostrar el error". */
const NOT_MERGED = /no están en otra rama|aren't in any other branch/
const LOCAL_CHANGES = /would be overwritten|commit your changes or stash them/i
const REJECTED = /\[rejected\]|non-fast-forward|fetch first|stale info/i

export const PULL_MODES: { mode: PullMode; label: string; detail: string }[] = [
  { mode: 'ff-or-merge', label: t('Traer (avance rápido si se puede)'), detail: t('Si las dos ramas tienen commits nuevos, las fusiona.') },
  { mode: 'ff-only', label: t('Traer (solo avance rápido)'), detail: t('Si no se puede avanzar sin fusionar, no hace nada.') },
  { mode: 'rebase', label: t('Traer (rebasando)'), detail: t('Pone tus commits encima de los del servidor.') }
]

interface Options {
  repo: RepoInfo
  /** Es la pestaña visible: solo esa responde a Ctrl+Z. */
  active: boolean
  refs: RefList
  status: WorkingTreeStatus | null
  stashes: StashInfo[]
  remotes: string[]
  filter: GraphFilter
  onFilterChange(filter: GraphFilter): void
  /** Relee ramas, historial, stashes y la carpeta de trabajo. */
  reload(): void
  onError(message: string | null): void
  onCompare(refA: string, refB: string): void
  /** Muestra un commit (o un stash) en el panel de detalle. */
  onShowCommit(sha: string): void
  /** Muestra el linaje de una rama. */
  onShowBranch(ref: string): void
}

export function useRepoActions(options: Options) {
  const { repo, active, refs, status, stashes, remotes, filter, onFilterChange, reload, onError, onCompare, onShowCommit, onShowBranch } = options
  const root = repo.root
  const dialog = useDialog()
  const [busy, setBusy] = useState<string | null>(null)
  const busyRef = useRef(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const stack = useRef(new UndoStack())
  // Sube cada vez que cambia la pila de deshacer, para redibujar los botones.
  const [, setStackVersion] = useState(0)
  const [pullMode, setPullModeState] = useState<PullMode>(() => loadSetting<PullMode>('pullMode', 'ff-or-merge'))
  const [progress, setProgress] = useState<GitProgress | null>(null)
  // Fetch automático cada tantos minutos (0: apagado). Es un pedido de red, así que viene apagado.
  const [autoFetch, setAutoFetchState] = useState<number>(() => loadSetting<number>('autoFetchMinutes', 0))

  const setAutoFetch = (minutes: number) => {
    setAutoFetchState(minutes)
    saveSetting('autoFetchMinutes', minutes)
  }

  // Progreso de fetch, pull y push de este repo (lo manda el proceso principal mientras corren).
  useEffect(() => api.onProgress((changed, value) => changed === root && setProgress(value)), [root])


  const setPullMode = (mode: PullMode) => {
    setPullModeState(mode)
    saveSetting('pullMode', mode)
  }

  // Al cerrar el aviso a los pocos segundos.
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), 7000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const finish = useCallback(
    (result: Result | void) => {
      if (result?.undo) {
        stack.current.push(result.undo)
        setStackVersion((v) => v + 1)
      }
      if (result?.message) setToast({ id: Date.now(), message: result.message, undoable: Boolean(result.undo) })
      reload()
    },
    [reload]
  )

  /** Ejecuta una operación a la vez, mostrando qué se está haciendo. Los errores van al aviso rojo. */
  const run = useCallback(
    async (label: string, task: () => Promise<Result | void>) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(label)
      onError(null)
      try {
        finish(await task())
      } catch (error) {
        onError(errorText(error))
        reload()
      } finally {
        busyRef.current = false
        setBusy(null)
        setProgress(null)
      }
    },
    [finish, onError, reload]
  )

  /** Pide datos con un diálogo y hace la operación desde ahí: si falla, el error queda en el diálogo. */
  const withDialog = useCallback(
    async (options: Omit<DialogOptions, 'onSubmit'>, task: (values: DialogValues) => Promise<Result | void>) => {
      let result: Result | void = undefined
      const confirmed = await dialog.show({
        ...options,
        onSubmit: async (values) => {
          busyRef.current = true
          try {
            result = await task(values)
          } finally {
            busyRef.current = false
          }
        }
      })
      if (confirmed) finish(result)
    },
    [dialog, finish]
  )

  const currentBranch = refs.current
  const currentName = currentBranch ? shortRef(currentBranch) : null
  const links = webLinks(repo.provider)
  const hasChanges = status !== null && status.staged.length + status.unstaged.length + status.conflicted.length > 0

  /** Ninguna operación de deshacer debería mover otra rama: se verifica que el repo siga donde estaba. */
  const onBranch = useCallback(
    async (branch: string | null) => {
      const now = (await api.listRefs(root)).current
      if (now !== branch) {
        throw new Error(branch ? t('Para deshacer esto, volvé a la rama {name}.', { name: shortRef(branch) }) : t('Para deshacer esto, el repo tiene que estar donde estaba.'))
      }
    },
    [root]
  )

  /** Operaciones que mueven HEAD (merge, rebase, cherry-pick, revert, pull): deshacer vuelve al commit de antes. */
  const movesHead = useCallback(
    async (label: string, done: string, task: () => Promise<Outcome | void>): Promise<Result> => {
      const branch = currentBranch
      const before = refs.head
      const outcome = await task()
      if (outcome === 'conflicts') return { message: t('Quedaron conflictos. Resolvelos, preparalos y tocá Continuar en el aviso de arriba.') }
      const after = (await api.listRefs(root)).head
      if (!before || !after || before === after) return { message: done }
      return {
        message: done,
        undo: {
          label,
          // keep: vuelve atrás sin pisar cambios sin commitear (si los pisaría, Git se niega).
          undo: async () => {
            await onBranch(branch)
            await api.reset(root, before, 'keep')
          },
          redo: async () => {
            await onBranch(branch)
            await api.reset(root, after, 'keep')
          }
        }
      }
    },
    [currentBranch, refs.head, root, onBranch]
  )

  // ---------- Operaciones ----------

  const checkout = useCallback(
    (target: string, label = shortRef(target)) => {
      const previous = refs.current ?? refs.head
      const doCheckout = async (): Promise<Result> => {
        const branch = await api.checkout(root, target)
        const message = branch ? t('Ahora estás en {name}.', { name: shortRef(branch) }) : t('Ahora estás en el commit {name} (HEAD desacoplado).', { name: shortSha(target) })
        if (!previous) return { message }
        return {
          message,
          undo: { label: t('cambiar a {label}', { label }), undo: async () => void (await api.checkout(root, previous)), redo: async () => void (await api.checkout(root, target)) }
        }
      }
      void run(t('Cambiando a {label}…', { label }), async () => {
        try {
          return await doCheckout()
        } catch (error) {
          if (!LOCAL_CHANGES.test(errorText(error))) throw error
          // Como GitKraken: ofrece guardar los cambios en un stash y cambiar igual.
          window.setTimeout(() => {
            void withDialog(
              {
                title: t('Tenés cambios sin commitear'),
                description: t('Cambiar a {label} pisaría algunos de tus cambios. Se pueden guardar aparte y recuperarlos después con Recuperar.', { label }),
                confirmLabel: t('Guardar aparte y cambiar')
              },
              async () => {
                await api.stash(root, t('Antes de cambiar a {label}', { label }))
                return doCheckout()
              }
            )
          })
        }
      })
    },
    [refs.current, refs.head, root, run, withDialog]
  )

  const createBranchAt = useCallback(
    (startPoint: string, startLabel: string) =>
      withDialog(
        {
          title: t('Crear una rama'),
          description: t('Sale de {startLabel}.', { startLabel }),
          fields: [
            { name: 'name', label: t('Nombre'), placeholder: t('feature/nombre'), required: true, mono: true },
            { name: 'checkout', label: t('Cambiar a la rama nueva'), kind: 'checkbox', value: true }
          ],
          confirmLabel: t('Crear rama')
        },
        async (values) => {
          const switchTo = values.checkout === true
          const previous = refs.current ?? refs.head
          const ref = await api.createBranch(root, String(values.name), startPoint, switchTo)
          const name = shortRef(ref)
          return {
            message: switchTo ? t('Rama {name} creada. Ahora estás en ella.', { name }) : t('Rama {name} creada.', { name }),
            undo: {
              label: t('crear la rama {name}', { name }),
              undo: async () => {
                if (switchTo && previous) await api.checkout(root, previous)
                await api.deleteBranch(root, ref, true)
              },
              redo: async () => void (await api.createBranch(root, name, startPoint, switchTo))
            }
          }
        }
      ),
    [refs.current, refs.head, root, withDialog]
  )

  const renameBranch = (ref: RefInfo) =>
    withDialog(
      {
        title: t('Renombrar {name}', { name: ref.name }),
        fields: [{ name: 'name', label: t('Nombre nuevo'), value: ref.name, required: true, mono: true }],
        confirmLabel: t('Renombrar')
      },
      async (values) => {
        const renamed = await api.renameBranch(root, ref.ref, String(values.name))
        return {
          message: t('La rama ahora se llama {name}.', { name: shortRef(renamed) }),
          undo: {
            label: t('renombrar {name}', { name: ref.name }),
            undo: async () => void (await api.renameBranch(root, renamed, ref.name)),
            redo: async () => void (await api.renameBranch(root, ref.ref, shortRef(renamed)))
          }
        }
      }
    )

  const remoteTwin = (ref: RefInfo) => (ref.upstream ? refs.refs.find((r) => r.ref === ref.upstream) : undefined)

  const deleteBranch = (ref: RefInfo) => {
    const twin = remoteTwin(ref)
    return withDialog(
      {
        title: t('Borrar la rama {name}', { name: ref.name }),
        description: t('Se puede deshacer con Ctrl+Z mientras la app siga abierta.'),
        fields: [
          { name: 'force', label: t('Borrarla aunque tenga commits que no están en otra rama'), kind: 'checkbox' },
          ...(twin ? [{ name: 'remote', label: t('Borrar también {name} en el servidor', { name: twin.name }), kind: 'checkbox' as const, hint: t('Esto no se puede deshacer desde GitOno.') }] : [])
        ],
        confirmLabel: t('Borrar'),
        danger: true
      },
      async (values) => {
        let sha: string
        try {
          sha = await api.deleteBranch(root, ref.ref, values.force === true)
        } catch (error) {
          if (NOT_MERGED.test(errorText(error))) throw new Error(t('{value} Marcá la primera opción para borrarla igual.', { value: errorText(error) }))
          throw error
        }
        if (twin && values.remote === true) await api.deleteRemoteBranch(root, twin.ref)
        return {
          message: t('Rama {name} borrada.', { name: ref.name }),
          undo: {
            label: t('borrar la rama {name}', { name: ref.name }),
            undo: async () => void (await api.createBranch(root, ref.name, sha, false)),
            redo: async () => void (await api.deleteBranch(root, ref.ref, true))
          }
        }
      }
    )
  }

  const deleteRemoteBranch = (ref: RefInfo) =>
    withDialog(
      {
        title: t('Borrar {name} en el servidor', { name: ref.name }),
        description: t('La rama deja de existir en el remoto para todos. Esto no se puede deshacer desde GitOno.'),
        confirmLabel: t('Borrar en el servidor'),
        danger: true
      },
      async () => {
        await api.deleteRemoteBranch(root, ref.ref)
        return { message: t('{name} se borró del servidor.', { name: ref.name }) }
      }
    )

  const merge = (ref: string, mode: MergeMode) => {
    const name = shortRef(ref)
    void run(t('Fusionando {name}…', { name }), () =>
      movesHead(t('fusionar {name}', { name }), t('{name} fusionada en {currentName}.', { name, currentName }), () => api.merge(root, ref, mode))
    )
  }

  const rebase = (onto: string, ontoLabel = shortRef(onto)) =>
    void run(t('Rebasando sobre {ontoLabel}…', { ontoLabel }), () =>
      movesHead(t('rebasar sobre {ontoLabel}', { ontoLabel }), t('{currentName} ahora está encima de {ontoLabel}.', { currentName, ontoLabel }), () => api.rebase(root, onto))
    )

  const fastForward = (ref: string, to: string) => {
    if (ref === currentBranch) {
      void run(t('Avanzando {name}…', { name: shortRef(ref) }), () =>
        movesHead(t('avanzar {name}', { name: shortRef(ref) }), t('{name} avanzó hasta {name2}.', { name: shortRef(ref), name2: shortRef(to) }), () => api.fastForward(root, ref, to))
      )
      return
    }
    void run(t('Avanzando {name}…', { name: shortRef(ref) }), async () => {
      await api.fastForward(root, ref, to)
      return { message: t('{name} avanzó hasta {name2}.', { name: shortRef(ref), name2: shortRef(to) }) }
    })
  }

  const cherryPick = (commit: CommitInfo) =>
    void run(t('Copiando el commit…'), () =>
      movesHead(t('copiar el commit {sha}', { sha: shortSha(commit.sha) }), t('Commit {name} copiado en {currentName}.', { name: shortSha(commit.sha), currentName }), () => api.cherryPick(root, commit.sha))
    )

  const revert = (commit: CommitInfo) =>
    void run(t('Revirtiendo…'), () =>
      movesHead(t('revertir {sha}', { sha: shortSha(commit.sha) }), t('Se creó un commit que revierte {name}.', { name: shortSha(commit.sha) }), () => api.revert(root, commit.sha))
    )

  const reset = async (commit: CommitInfo, mode: ResetMode) => {
    const branch = currentBranch
    const before = refs.head
    const task = async (): Promise<Result> => {
      await api.reset(root, commit.sha, mode)
      const message = t('{value} ahora apunta a {name}.', { value: currentName ?? 'HEAD', name: shortSha(commit.sha) })
      if (!before) return { message }
      return {
        message,
        undo: {
          label: t('restablecer a {name}', { name: shortSha(commit.sha) }),
          undo: async () => {
            await onBranch(branch)
            await api.reset(root, before, mode === 'hard' ? 'keep' : mode)
          },
          redo: async () => {
            await onBranch(branch)
            await api.reset(root, commit.sha, mode === 'hard' ? 'keep' : mode)
          }
        }
      }
    }
    if (mode !== 'hard') {
      void run(t('Restableciendo…'), task)
      return
    }
    const lost = t('Los commits que quedan afuera se pueden recuperar con Ctrl+Z, pero los cambios sin commitear se pierden.')
    await withDialog(
      {
        title: t('Restablecer en duro a {name}', { name: shortSha(commit.sha) }),
        description: hasChanges ? t('Tenés cambios sin commitear. {lost}', { lost }) : lost,
        confirmLabel: hasChanges ? t('Descartar todo y restablecer') : t('Restablecer'),
        danger: true
      },
      task
    )
  }

  const createTagAt = (sha: string, label: string) =>
    withDialog(
      {
        title: t('Crear una etiqueta'),
        description: t('En {label}.', { label }),
        fields: [
          { name: 'name', label: t('Nombre'), placeholder: 'v1.0.0', required: true, mono: true },
          { name: 'annotated', label: t('Etiqueta anotada (con mensaje)'), kind: 'checkbox' },
          { name: 'message', label: t('Mensaje'), kind: 'textarea', showIf: 'annotated' },
          ...(remotes.length > 0 ? [{ name: 'push', label: t('Subirlo a {value}', { value: remotes.includes('origin') ? 'origin' : remotes[0] }), kind: 'checkbox' as const }] : [])
        ],
        confirmLabel: t('Crear etiqueta')
      },
      async (values) => {
        const message = values.annotated === true ? String(values.message) || String(values.name) : null
        const ref = await api.createTag(root, String(values.name), sha, message)
        if (values.push === true) await api.pushTag(root, ref, remotes.includes('origin') ? 'origin' : remotes[0])
        return {
          message: t('Etiqueta {name} creada.', { name: shortRef(ref) }),
          undo: {
            label: t('crear la etiqueta {name}', { name: shortRef(ref) }),
            undo: async () => void (await api.deleteTag(root, ref)),
            redo: async () => void (await api.createTag(root, shortRef(ref), sha, message))
          }
        }
      }
    )

  const deleteTag = (ref: RefInfo) =>
    withDialog(
      {
        title: t('Borrar la etiqueta {name}', { name: ref.name }),
        fields: remotes.map((remote) => ({ name: `remote:${remote}`, label: t('Borrarlo también en {remote}', { remote }), kind: 'checkbox' as const })),
        confirmLabel: t('Borrar'),
        danger: true
      },
      async (values) => {
        const sha = await api.deleteTag(root, ref.ref)
        for (const remote of remotes) if (values[`remote:${remote}`] === true) await api.deleteRemoteTag(root, ref.ref, remote)
        return {
          message: t('Etiqueta {name} borrada.', { name: ref.name }),
          undo: {
            label: t('borrar la etiqueta {name}', { name: ref.name }),
            undo: async () => void (await api.createTag(root, ref.name, sha, null)),
            redo: async () => void (await api.deleteTag(root, ref.ref))
          }
        }
      }
    )

  const pushTag = (ref: RefInfo, remote: string) =>
    void run(t('Subiendo {name}…', { name: ref.name }), async () => {
      await api.pushTag(root, ref.ref, remote)
      return { message: t('Etiqueta {name} subida a {remote}.', { name: ref.name, remote }) }
    })

  const push = useCallback(
    (ref: string) => {
      const name = shortRef(ref)
      void run(t('Subiendo {name}…', { name }), async () => {
        try {
          await api.push(root, ref, false)
          return { message: t('{name} subida al servidor.', { name }) }
        } catch (error) {
          if (!REJECTED.test(errorText(error))) throw error
          window.setTimeout(() => {
            void withDialog(
              {
                title: t('El servidor tiene commits que no tenés'),
                description: t('Traelos antes de subir {name}. Forzar la subida reemplaza la rama del servidor por la tuya (con --force-with-lease, que no pisa commits que todavía no viste).', { name }),
                confirmLabel: t('Forzar la subida'),
                danger: true
              },
              async () => {
                await api.push(root, ref, true)
                return { message: t('{name} subida al servidor (forzado).', { name }) }
              }
            )
          })
          return undefined
        }
      })
    },
    [root, run, withDialog]
  )

  const pull = useCallback(
    (mode: PullMode = pullMode) =>
      void run(t('Trayendo novedades…'), () => movesHead('pull', t('Rama actualizada con el servidor.'), () => api.pull(root, mode))),
    [pullMode, root, run, movesHead]
  )

  // Fetch automático, sin avisos: si falla (sin internet, por ejemplo) se vuelve a probar la próxima vez.
  useEffect(() => {
    if (autoFetch <= 0) return
    const timer = window.setInterval(() => {
      if (busyRef.current) return
      api.fetchAll(root).then(reload, () => undefined)
    }, autoFetch * 60_000)
    return () => window.clearInterval(timer)
  }, [autoFetch, root, reload])

  const openIn = useCallback(
    (target: OpenTarget) => void api.openIn(root, target).catch((e: Error) => onError(e.message)),
    [root, onError]
  )

  const fetchAll = useCallback(
    () =>
      void run(t('Trayendo novedades…'), async () => {
        await api.fetchAll(root)
        return { message: t('Ramas remotas actualizadas.') }
      }),
    [root, run]
  )

  const setUpstream = (ref: RefInfo, upstream: string | null) => {
    const previous = ref.upstream ?? null
    void run(t('Cambiando la rama que sigue…'), async () => {
      await api.setUpstream(root, ref.ref, upstream)
      return {
        message: upstream ? t('{name} ahora sigue a {name2}.', { name: ref.name, name2: shortRef(upstream) }) : t('{name} ya no sigue ninguna rama remota.', { name: ref.name }),
        undo: {
          label: t('cambiar la rama que sigue {name}', { name: ref.name }),
          undo: () => api.setUpstream(root, ref.ref, previous),
          redo: () => api.setUpstream(root, ref.ref, upstream)
        }
      }
    })
  }

  const chooseUpstream = (ref: RefInfo) => {
    const options = refs.refs.filter((r) => r.kind === 'remote').map((r) => ({ value: r.ref, label: r.name }))
    if (options.length === 0) {
      onError(t('Este repo no tiene ramas remotas. Subí la rama para publicarla.'))
      return
    }
    void withDialog(
      {
        title: t('Rama remota que sigue {name}', { name: ref.name }),
        fields: [{ name: 'upstream', label: t('Rama remota'), kind: 'select', options, value: ref.upstream ?? options[0].value }],
        confirmLabel: t('Seguir esta rama')
      },
      async (values) => {
        await api.setUpstream(root, ref.ref, String(values.upstream))
        return { message: t('{name} ahora sigue a {name2}.', { name: ref.name, name2: shortRef(String(values.upstream)) }) }
      }
    )
  }

  // ---------- Stash ----------

  const stashChanges = useCallback(
    () =>
      withDialog(
        {
          title: t('Guardar los cambios aparte'),
          description: t('Los cambios sin commitear (también los archivos nuevos) se guardan aparte y la carpeta queda limpia.'),
          fields: [{ name: 'message', label: t('Mensaje'), placeholder: t('Opcional') }],
          confirmLabel: t('Guardar aparte')
        },
        async (values) => {
          const message = String(values.message)
          if (!(await api.stash(root, message))) return { message: t('No había cambios para guardar.') }
          return {
            message: t('Cambios guardados aparte.'),
            undo: {
              label: t('guardar los cambios aparte'),
              undo: async () => void (await api.applyStash(root, 0, true)),
              redo: async () => void (await api.stash(root, message))
            }
          }
        }
      ),
    [root, withDialog]
  )

  const applyStash = useCallback(
    (stash: StashInfo, pop: boolean) =>
      void run(pop ? t('Recuperando los cambios guardados…') : t('Aplicando los cambios guardados…'), async () => {
        const outcome = await api.applyStash(root, stash.index, pop)
        if (outcome === 'conflicts') return { message: t('Los cambios guardados se aplicaron con conflictos. Resolvelos y preparalos; siguen guardados.') }
        return { message: pop ? t('Cambios recuperados y borrados de los guardados.') : t('Cambios aplicados (siguen guardados).') }
      }),
    [root, run]
  )

  const dropStash = (stash: StashInfo) =>
    withDialog(
      {
        title: t('Borrar los cambios guardados'),
        description: t('"{message}". Se puede deshacer con Ctrl+Z mientras la app siga abierta.', { message: stash.message }),
        confirmLabel: t('Borrar'),
        danger: true
      },
      async () => {
        const sha = await api.dropStash(root, stash.index)
        return {
          message: t('Cambios guardados borrados.'),
          undo: {
            label: t('borrar los cambios guardados'),
            undo: () => api.restoreStash(root, sha, stash.message),
            redo: async () => void (await api.dropStash(root, 0))
          }
        }
      }
    )

  const renameStash = (stash: StashInfo) =>
    withDialog(
      {
        title: t('Cambiar el mensaje de los cambios guardados'),
        fields: [{ name: 'message', label: t('Mensaje'), value: stash.message, required: true }],
        confirmLabel: t('Guardar')
      },
      async (values) => {
        await api.renameStash(root, stash.index, String(values.message))
        return { message: t('Mensaje cambiado.') }
      }
    )

  /** Descarta todo: se guarda en un stash y se borra, así Deshacer lo recupera. */
  const discardAll = () =>
    withDialog(
      {
        title: t('Descartar todos los cambios'),
        description: t('Se descartan los cambios preparados, los sin preparar y los archivos nuevos. Se puede deshacer con Ctrl+Z mientras la app siga abierta.'),
        confirmLabel: t('Descartar todo'),
        danger: true
      },
      async () => {
        await api.stash(root, t('Cambios descartados desde GitOno'))
        const sha = await api.dropStash(root, 0)
        return {
          message: t('Cambios descartados.'),
          undo: {
            label: t('descartar los cambios'),
            undo: async () => {
              await api.restoreStash(root, sha, t('Cambios descartados desde GitOno'))
              await api.applyStash(root, 0, true)
            },
            redo: async () => {
              await api.stash(root, t('Cambios descartados desde GitOno'))
              await api.dropStash(root, 0)
            }
          }
        }
      }
    )

  // ---------- Operación a medio hacer ----------

  const continueOperation = () =>
    void run(t('Continuando…'), async () => {
      const outcome = await api.continueOperation(root)
      return { message: outcome === 'conflicts' ? t('Aparecieron más conflictos: resolvelos y volvé a continuar.') : t('Listo, la operación terminó.') }
    })

  const abortOperation = () =>
    withDialog(
      {
        title: t('Abortar la operación'),
        description: t('El repo vuelve a como estaba antes de empezar. Se pierde lo que hayas resuelto de los conflictos.'),
        confirmLabel: t('Abortar'),
        danger: true
      },
      async () => {
        await api.abortOperation(root)
        return { message: t('Operación abortada.') }
      }
    )

  // ---------- Deshacer / Rehacer ----------

  const undo = useCallback(() => {
    const entry = stack.current.nextUndo
    if (!entry) return
    void run(t('Deshaciendo: {label}…', { label: entry.label }), async () => {
      await stack.current.undo()
      setStackVersion((v) => v + 1)
      return { message: t('Deshecho: {label}.', { label: entry.label }) }
    })
  }, [run])

  const redo = useCallback(() => {
    const entry = stack.current.nextRedo
    if (!entry) return
    void run(t('Rehaciendo: {label}…', { label: entry.label }), async () => {
      await stack.current.redo()
      setStackVersion((v) => v + 1)
      return { message: t('Rehecho: {label}.', { label: entry.label }) }
    })
  }, [run])

  // Ctrl+Z / Ctrl+Y (o Ctrl+Shift+Z), salvo mientras se escribe en un campo o en el diff. Solo en la
  // pestaña visible: las demás están ocultas pero montadas.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable], .monaco-editor, .dialog')) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) undo()
      else if (key === 'y' || (key === 'z' && e.shiftKey)) redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, undo, redo])

  /** Para deshacer un commit hecho desde el panel de cambios: vuelve atrás y deja los cambios preparados. */
  const recordCommit = useCallback(
    (before: string | null, after: string) => {
      if (!before) return
      const branch = currentBranch
      stack.current.push({
        label: t('el commit'),
        undo: async () => {
          await onBranch(branch)
          await api.reset(root, before, 'soft')
        },
        redo: async () => {
          await onBranch(branch)
          await api.reset(root, after, 'soft')
        }
      })
      setStackVersion((v) => v + 1)
    },
    [currentBranch, onBranch, root]
  )

  // ---------- Gráfico: ocultar y mostrar solo ----------

  const hidden = new Set(filter.hidden)
  const solo = new Set(filter.solo)
  const filtered = filter.hidden.length > 0 || filter.solo.length > 0
  const toggleHidden = (ref: string) =>
    onFilterChange({ hidden: hidden.has(ref) ? filter.hidden.filter((r) => r !== ref) : [...filter.hidden, ref], solo: filter.solo })
  const toggleSolo = (ref: string) =>
    onFilterChange({ hidden: filter.hidden, solo: solo.has(ref) ? filter.solo.filter((r) => r !== ref) : [...filter.solo, ref] })
  const showAll = () => onFilterChange({ hidden: [], solo: [] })

  const copy = (text: string, what: string) =>
    void api.copyText(text).then(
      () => setToast({ id: Date.now(), message: t('{what} copiado.', { what }), undoable: false }),
      (e: Error) => onError(e.message)
    )
  const openLink = (url: string) => void api.openExternal(url).catch((e: Error) => onError(e.message))

  // ---------- Menús ----------

  const separator: MenuItem = { kind: 'separator' }

  const graphItems = (ref: RefInfo): MenuItem[] => [
    hidden.has(ref.ref)
      ? { label: t('Volver a mostrar en el gráfico'), icon: Eye, onSelect: () => toggleHidden(ref.ref) }
      : { label: t('Ocultar en el gráfico'), icon: EyeOff, onSelect: () => toggleHidden(ref.ref) },
    solo.has(ref.ref)
      ? { label: t('Dejar de mostrar solo esta'), icon: Focus, onSelect: () => toggleSolo(ref.ref) }
      : { label: filter.solo.length > 0 ? t('Sumar a las que se muestran solas') : t('Mostrar solo esta rama'), icon: Focus, onSelect: () => toggleSolo(ref.ref) },
    ...(filtered ? [{ label: t('Mostrar todas las ramas'), icon: Eye, onSelect: showAll } as MenuItem] : [])
  ]

  const integrationItems = (ref: RefInfo): MenuEntry[] => {
    if (!currentBranch || ref.ref === currentBranch) return []
    return [
      { label: t('Fusionar {name} en {currentName}', { name: ref.name, currentName }), icon: GitMerge, onSelect: () => merge(ref.ref, 'default') },
      {
        kind: 'submenu',
        label: t('Más formas de fusionar'),
        icon: GitMerge,
        items: [
          { label: t('Siempre con commit de fusión (--no-ff)'), onSelect: () => merge(ref.ref, 'no-ff') },
          { label: t('Solo si es avance rápido (--ff-only)'), onSelect: () => merge(ref.ref, 'ff-only') }
        ]
      },
      { label: t('Rebasar {currentName} sobre {name}', { currentName, name: ref.name }), icon: GitCommitHorizontal, onSelect: () => rebase(ref.ref) }
    ]
  }

  const refMenu = (ref: RefInfo): MenuItem[] => {
    const isCurrent = ref.ref === currentBranch
    const kindLabel = { local: t('Rama'), remote: t('Rama remota'), tag: t('Etiqueta') }[ref.kind]
    const items: MenuEntry[] = [{ kind: 'label', label: `${kindLabel} ${ref.name}${isCurrent ? t(' (actual)') : ''}` }]

    if (ref.kind === 'local') {
      const upstreamName = ref.upstream ? shortRef(ref.upstream) : null
      const upstreamBranch = upstreamName ? splitRemoteName(upstreamName) : null
      items.push(
        !isCurrent && { label: t('Cambiar a {name}', { name: ref.name }), icon: LogIn, hint: t('Doble clic'), onSelect: () => checkout(ref.ref) },
        isCurrent && { label: t('Traer'), icon: ArrowDownToLine, onSelect: () => pull() },
        { label: upstreamName ? t('Subir a {upstreamName}', { upstreamName }) : t('Publicar {name} (subir)', { name: ref.name }), icon: ArrowUpFromLine, disabled: remotes.length === 0, onSelect: () => push(ref.ref) },
        !isCurrent &&
          ref.upstream !== undefined &&
          (ref.behind ?? 0) > 0 &&
          (ref.ahead ?? 0) === 0 && { label: t('Avanzar {name} hasta {upstreamName}', { name: ref.name, upstreamName }), icon: FastForward, onSelect: () => fastForward(ref.ref, ref.upstream!) },
        separator,
        ...integrationItems(ref),
        separator,
        { label: t('Crear una rama acá…'), icon: GitBranchPlus, onSelect: () => void createBranchAt(ref.target, ref.name) },
        { label: t('Crear una etiqueta acá…'), icon: Tag, onSelect: () => void createTagAt(ref.target, ref.name) },
        separator,
        currentBranch && !isCurrent && { label: t('Comparar con {currentName}', { currentName }), icon: GitCompareArrows, onSelect: () => onCompare(currentBranch, ref.ref) },
        { label: t('Ver de dónde sale'), icon: Crosshair, onSelect: () => onShowBranch(ref.ref) },
        ...graphItems(ref),
        separator,
        {
          kind: 'submenu',
          label: t('Rama remota que sigue'),
          icon: Link,
          disabled: remotes.length === 0,
          items: tidy([
            ...refs.refs
              .filter((r) => r.kind === 'remote' && splitRemoteName(r.name).branch === ref.name)
              .map((r): MenuItem => ({ kind: 'check', label: r.name, checked: r.ref === ref.upstream, onSelect: () => setUpstream(ref, r.ref) })),
            { label: t('Elegir otra…'), onSelect: () => chooseUpstream(ref) },
            ref.upstream ? { label: t('Dejar de seguir {upstreamName}', { upstreamName }), onSelect: () => setUpstream(ref, null) } : false
          ])
        },
        links && upstreamBranch && { label: t('Abrir en {name}', { name: links.name }), icon: ExternalLink, onSelect: () => openLink(links.branch(upstreamBranch.branch)) },
        links &&
          upstreamBranch && { label: t('Crear un {requestName}', { requestName: links.requestName }), icon: GitPullRequestCreateArrow, onSelect: () => openLink(links.newRequest(upstreamBranch.branch)) },
        { label: t('Copiar el nombre'), icon: Copy, onSelect: () => copy(ref.name, t('Nombre')) },
        { label: t('Copiar el SHA'), icon: Copy, onSelect: () => copy(ref.target, 'SHA') },
        separator,
        { label: t('Renombrar {name}…', { name: ref.name }), icon: Pencil, onSelect: () => void renameBranch(ref) },
        { label: isCurrent ? t('No se puede borrar la rama actual') : t('Borrar {name}…', { name: ref.name }), icon: Trash, danger: true, disabled: isCurrent, onSelect: () => void deleteBranch(ref) }
      )
    } else if (ref.kind === 'remote') {
      const { branch } = splitRemoteName(ref.name)
      const local = refs.refs.find((r) => r.kind === 'local' && r.name === branch)
      items.push(
        local?.ref !== currentBranch && {
          label: local ? t('Cambiar a {name}', { name: local.name }) : t('Cambiar a esta rama (crea la rama local {branch})', { branch }),
          icon: LogIn,
          hint: t('Doble clic'),
          onSelect: () => checkout(ref.ref, branch)
        },
        local &&
          local.upstream === ref.ref &&
          (local.behind ?? 0) > 0 &&
          (local.ahead ?? 0) === 0 &&
          (local.ref === currentBranch
            ? { label: t('Traer: avanzar {name} hasta {name2}', { name: local.name, name2: ref.name }), icon: ArrowDownToLine, onSelect: () => pull('ff-only') }
            : { label: t('Avanzar {name} hasta {name2}', { name: local.name, name2: ref.name }), icon: FastForward, onSelect: () => fastForward(local.ref, ref.ref) }),
        separator,
        ...integrationItems(ref),
        separator,
        { label: t('Crear una rama acá…'), icon: GitBranchPlus, onSelect: () => void createBranchAt(ref.target, ref.name) },
        { label: t('Crear una etiqueta acá…'), icon: Tag, onSelect: () => void createTagAt(ref.target, ref.name) },
        separator,
        currentBranch && { label: t('Comparar con {currentName}', { currentName }), icon: GitCompareArrows, onSelect: () => onCompare(currentBranch, ref.ref) },
        { label: t('Ver de dónde sale'), icon: Crosshair, onSelect: () => onShowBranch(ref.ref) },
        ...graphItems(ref),
        separator,
        links && { label: t('Abrir en {name}', { name: links.name }), icon: ExternalLink, onSelect: () => openLink(links.branch(branch)) },
        links && { label: t('Crear un {requestName}', { requestName: links.requestName }), icon: GitPullRequestCreateArrow, onSelect: () => openLink(links.newRequest(branch)) },
        { label: t('Copiar el nombre'), icon: Copy, onSelect: () => copy(ref.name, t('Nombre')) },
        { label: t('Copiar el SHA'), icon: Copy, onSelect: () => copy(ref.target, 'SHA') },
        separator,
        { label: t('Borrar {name} en el servidor…', { name: ref.name }), icon: Trash, danger: true, onSelect: () => void deleteRemoteBranch(ref) }
      )
    } else {
      items.push(
        { label: t('Cambiar al commit (HEAD desacoplado)'), icon: LogIn, onSelect: () => checkout(ref.ref) },
        separator,
        ...integrationItems(ref),
        separator,
        { label: t('Crear una rama acá…'), icon: GitBranchPlus, onSelect: () => void createBranchAt(ref.target, ref.name) },
        currentBranch && { label: t('Comparar con {currentName}', { currentName }), icon: GitCompareArrows, onSelect: () => onCompare(currentBranch, ref.ref) },
        ...graphItems(ref),
        separator,
        ...remotes.map((remote): MenuItem => ({ label: t('Subir la etiqueta a {remote}', { remote }), icon: Upload, onSelect: () => pushTag(ref, remote) })),
        { label: t('Copiar el nombre'), icon: Copy, onSelect: () => copy(ref.name, t('Nombre')) },
        { label: t('Copiar el SHA'), icon: Copy, onSelect: () => copy(ref.target, 'SHA') },
        separator,
        { label: t('Borrar la etiqueta {name}…', { name: ref.name }), icon: Trash, danger: true, onSelect: () => void deleteTag(ref) }
      )
    }
    return tidy(items)
  }

  const commitMenu = (commit: CommitInfo): MenuItem[] => {
    const isHead = commit.sha === refs.head
    const short = shortSha(commit.sha)
    return tidy([
      { kind: 'label', label: t('Commit {short}', { short }) },
      !isHead && { label: t('Cambiar a este commit (HEAD desacoplado)'), icon: LogIn, onSelect: () => checkout(commit.sha, short) },
      { label: t('Crear una rama acá…'), icon: GitBranchPlus, onSelect: () => void createBranchAt(commit.sha, t('el commit {short}', { short })) },
      { label: t('Crear una etiqueta acá…'), icon: Tag, onSelect: () => void createTagAt(commit.sha, t('el commit {short}', { short })) },
      separator,
      currentBranch && !isHead && { label: t('Copiar el commit en {currentName} (cherry-pick)', { currentName }), icon: Cherry, onSelect: () => cherryPick(commit) },
      refs.head && { label: t('Revertir este commit'), icon: RotateCcw, onSelect: () => revert(commit) },
      refs.head &&
        !isHead && {
          kind: 'submenu',
          label: t('Restablecer {value} a este commit', { value: currentName ?? 'HEAD' }),
          icon: ListRestart,
          items: [
            { label: t('Suave: los cambios quedan preparados'), onSelect: () => void reset(commit, 'soft') },
            { label: t('Mixto: los cambios quedan sin preparar'), onSelect: () => void reset(commit, 'mixed') },
            { label: t('Duro: descarta los cambios…'), danger: true, onSelect: () => void reset(commit, 'hard') }
          ]
        },
      currentBranch && !isHead && { label: t('Rebasar {currentName} sobre este commit', { currentName }), icon: GitCommitHorizontal, onSelect: () => rebase(commit.sha, short) },
      separator,
      { label: t('Guardar como parche…'), icon: FileDown, onSelect: () => void api.savePatch(root, commit.sha).catch((e: Error) => onError(e.message)) },
      links && { label: t('Abrir en {name}', { name: links.name }), icon: ExternalLink, onSelect: () => openLink(links.commit(commit.sha)) },
      links && { label: t('Copiar el enlace'), icon: Link, onSelect: () => copy(links.commit(commit.sha), t('Enlace')) },
      { label: t('Copiar el SHA'), icon: Copy, onSelect: () => copy(commit.sha, 'SHA') },
      { label: t('Copiar el mensaje'), icon: Copy, onSelect: () => copy(commit.subject, t('Mensaje')) }
    ])
  }

  const wipMenu = (): MenuItem[] =>
    tidy([
      { kind: 'label', label: t('Cambios sin commitear') },
      { label: t('Guardar aparte…'), icon: Archive, onSelect: () => void stashChanges() },
      refs.head && { label: t('Crear una rama con estos cambios…'), icon: GitBranchPlus, onSelect: () => void createBranchAt(refs.head!, currentName ?? 'HEAD') },
      separator,
      { label: t('Descartar todos los cambios…'), icon: Trash, danger: true, onSelect: () => void discardAll() }
    ])

  const stashMenu = (stash: StashInfo): MenuItem[] =>
    tidy([
      { kind: 'label', label: `stash@{${stash.index}}` },
      { label: t('Aplicar (queda guardado)'), icon: ArchiveRestore, onSelect: () => applyStash(stash, false) },
      { label: t('Recuperar (aplicar y borrar)'), icon: PackageOpen, onSelect: () => applyStash(stash, true) },
      { label: t('Ver sus cambios'), icon: Eye, onSelect: () => onShowCommit(stash.sha) },
      separator,
      { label: t('Cambiar el mensaje…'), icon: Pencil, onSelect: () => void renameStash(stash) },
      { label: t('Borrar…'), icon: Trash, danger: true, onSelect: () => void dropStash(stash) }
    ])

  /** Una rama arrastrada sobre otra, como en GitKraken. */
  const dropMenu = (source: RefInfo, target: RefInfo): MenuItem[] => {
    if (source.ref === target.ref) return []
    const items: MenuEntry[] = [{ kind: 'label', label: `${source.name} → ${target.name}` }]
    if (target.kind === 'local') {
      const targetIsCurrent = target.ref === currentBranch
      items.push(
        targetIsCurrent
          ? { label: t('Fusionar {name} en {name2}', { name: source.name, name2: target.name }), icon: GitMerge, onSelect: () => merge(source.ref, 'default') }
          : {
              label: t('Cambiar a {name} y fusionar {name2}', { name: target.name, name2: source.name }),
              icon: GitMerge,
              onSelect: () =>
                void run(t('Fusionando {name} en {name2}…', { name: source.name, name2: target.name }), async () => {
                  await api.checkout(root, target.ref)
                  const outcome = await api.merge(root, source.ref, 'default')
                  return { message: outcome === 'conflicts' ? t('Quedaron conflictos. Resolvelos y tocá Continuar.') : t('{name} fusionada en {name2}.', { name: source.name, name2: target.name }) }
                })
            },
        source.ref === currentBranch
          ? { label: t('Rebasar {name} sobre {name2}', { name: source.name, name2: target.name }), icon: GitCommitHorizontal, onSelect: () => rebase(target.ref) }
          : source.kind === 'local' && {
              label: t('Cambiar a {name} y rebasarla sobre {name2}', { name: source.name, name2: target.name }),
              icon: GitCommitHorizontal,
              onSelect: () =>
                void run(t('Rebasando {name}…', { name: source.name }), async () => {
                  await api.checkout(root, source.ref)
                  const outcome = await api.rebase(root, target.ref)
                  return { message: outcome === 'conflicts' ? t('Quedaron conflictos. Resolvelos y tocá Continuar.') : t('{name} ahora está encima de {name2}.', { name: source.name, name2: target.name }) }
                })
            },
        { label: t('Avanzar {name} hasta {name2} (si es avance rápido)', { name: target.name, name2: source.name }), icon: FastForward, onSelect: () => fastForward(target.ref, source.ref) }
      )
    }
    items.push({ kind: 'separator' }, { label: t('Comparar {name} con {name2}', { name: source.name, name2: target.name }), icon: GitCompareArrows, onSelect: () => onCompare(target.ref, source.ref) })
    return tidy(items)
  }

  const menus = { ref: refMenu, commit: commitMenu, wip: wipMenu, stash: stashMenu, drop: dropMenu }

  return {
    busy,
    progress,
    autoFetch,
    setAutoFetch,
    openIn,
    toast,
    dismissToast: () => setToast(null),
    undoLabel: stack.current.nextUndo?.label ?? null,
    redoLabel: stack.current.nextRedo?.label ?? null,
    undo,
    redo,
    menus,
    checkout,
    pull,
    pullMode,
    setPullMode,
    fetchAll,
    push,
    createBranchAt,
    stashChanges,
    applyStash,
    continueOperation,
    abortOperation,
    hasChanges,
    latestStash: stashes[0] ?? null,
    filtered,
    showAll,
    recordCommit
  }
}

export type RepoActions = ReturnType<typeof useRepoActions>

/** Los menús de clic derecho, que usan el historial y el panel de ramas. */
export type ActionMenus = RepoActions['menus']
