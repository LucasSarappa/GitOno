import { ArrowUp, Check, ChevronDown, Copy, FolderTree, GitBranch, GitMerge, List } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CommitDetails as Details, FileChange } from '../../../shared/types'
import { api } from '../api'
import { absoluteDate, relativeDate, shortSha } from '../lib/format'
import { describeMerge } from '../lib/merge'
import { setDetailsPrefs, useDetailsPrefs } from '../lib/detailsPrefs'
import { buildTree, type TreeNode } from '../lib/tree'
import { Avatar } from './Avatar'
import { FileTree } from './FileTree'
import { t, tn } from '../../../shared/i18n'
import { tr } from '../lib/i18n'

type LoadState = { status: 'loading' } | { status: 'ready'; details: Details } | { status: 'error'; message: string }

interface Props {
  root: string
  sha: string
  /** Cambia cuando cambian las ramas: "En ramas" se vuelve a calcular. */
  refsVersion: number
  selectedPath: string | null
  onOpenFile(change: FileChange, details: Details): void
  onSelectCommit(sha: string): void
  /** Mostrar el linaje de una rama, por su nombre corto (ej. "main" u "origin/main"). */
  onSelectBranch(name: string): void
}

/** Panel derecho del historial: mensaje, autor, ramas, padres y archivos del commit elegido. */
export function CommitDetails({ root, sha, refsVersion, selectedPath, onOpenFile, onSelectCommit, onSelectBranch }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [branches, setBranches] = useState<string[] | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [bodyOpen, setBodyOpen] = useState(false)
  const [branchesOpen, setBranchesOpen] = useState(false)
  const prefs = useDetailsPrefs()

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setCopied(false)
    setBodyOpen(false)
    setBranchesOpen(false)
    api.commitDetails(root, sha).then(
      (details) => !cancelled && setState({ status: 'ready', details }),
      (error: Error) => !cancelled && setState({ status: 'error', message: error.message })
    )
    return () => {
      cancelled = true
    }
  }, [root, sha])

  // Las ramas que contienen el commit cambian al crear, borrar o mover ramas.
  useEffect(() => {
    let cancelled = false
    setBranches(null)
    api.branchesContaining(root, sha).then(
      (list) => !cancelled && setBranches(list),
      () => !cancelled && setBranches([])
    )
    return () => {
      cancelled = true
    }
  }, [root, sha, refsVersion])

  const tree = useMemo(() => (state.status === 'ready' ? buildTree(state.details.files) : []), [state])

  if (state.status === 'loading') return <div className="details details--empty text-2">{t('Cargando…')}</div>
  if (state.status === 'error') return <div className="details details--empty error-text">{state.message}</div>

  const { details } = state
  const body = details.message.slice(details.subject.length).trim()
  const committedBySomeoneElse = details.committerEmail !== details.authorEmail || details.committerName !== details.authorName
  const isMerge = details.parents.length > 1
  const merge = isMerge ? describeMerge(details.subject) : null
  let additions = 0
  let deletions = 0
  for (const file of details.files) {
    additions += file.additions ?? 0
    deletions += file.deletions ?? 0
  }

  const copySha = () => {
    void api.copyText(details.sha).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  // En lista, cada archivo con su ruta completa; en árbol, agrupados por carpeta.
  const nodes: TreeNode[] = prefs.files === 'list' ? details.files.map((change) => ({ kind: 'file', name: change.path, change })) : tree
  const longBody = body.split('\n').length > 3 || body.length > 240

  return (
    <div className="details">
      <div className="details__header">
        <h2 className="details__subject">{details.subject}</h2>
        {body && (
          <>
            <p className={`details__body${prefs.fullMessage || bodyOpen || !longBody ? '' : ' details__body--clamped'}`}>{body}</p>
            {longBody && !prefs.fullMessage && (
              <button className="link link--plain" onClick={() => setBodyOpen((o) => !o)}>
                {bodyOpen ? t('Ver menos') : t('Ver más')}
              </button>
            )}
          </>
        )}
        {isMerge && (
          <p className="details__merge">
            <GitMerge size={14} strokeWidth={1.75} aria-hidden />
            {merge ? (
              <span>
                {merge.into
                  ? tr('Fusión de {from} en {into}', { from: <BranchLink name={merge.from} onSelect={onSelectBranch} />, into: <BranchLink name={merge.into} onSelect={onSelectBranch} /> })
                  : tr('Fusión de {from}', { from: <BranchLink name={merge.from} onSelect={onSelectBranch} /> })}
                {merge.request !== null && <span className="text-2"> {t('· pull request #{n}', { n: merge.request })}</span>}
              </span>
            ) : (
              <span>
                {tr('Une {from} en {into}', { from: <code>{shortSha(details.parents[1])}</code>, into: <code>{shortSha(details.parents[0])}</code> })}
              </span>
            )}
          </p>
        )}

        {/* Autor y fecha en una línea, como GitKraken; el email y la fecha exacta, en el tooltip. */}
        <div
          className="details__person"
          title={`${details.authorName} <${details.authorEmail}>\n${absoluteDate(details.authorDate)}${
            committedBySomeoneElse ? t('\nCommit hecho por {committerName} el {value}', { committerName: details.committerName, value: absoluteDate(details.committerDate) }) : ''
          }`}
        >
          <Avatar name={details.authorName} email={details.authorEmail} size={20} />
          <strong>{details.authorName}</strong>
          <span className="text-2">{relativeDate(details.authorDate)}</span>
        </div>

        {prefs.facts && (
          <div className="details__chips">
            <button className="chip chip--mono" onClick={copySha} title={t('{sha}\nClic para copiarlo', { sha: details.sha })}>
              {copied ? <Check size={12} strokeWidth={2.25} aria-hidden /> : <Copy size={12} strokeWidth={1.75} aria-hidden />}
              {copied ? t('Copiado') : shortSha(details.sha)}
            </button>
            {details.parents.length === 0 ? (
              <span className="chip chip--quiet">{t('primer commit')}</span>
            ) : (
              details.parents.map((parent, i) => (
                <button key={parent} className="chip chip--mono" onClick={() => onSelectCommit(parent)} title={`${i === 0 ? t('Padre') : t('Segundo padre')}: ${parent}`}>
                  <ArrowUp size={12} strokeWidth={1.75} aria-hidden />
                  {shortSha(parent)}
                </button>
              ))
            )}
            {branches === null ? null : branches.length === 0 ? (
              <span className="chip chip--quiet" title={t('Solo en etiquetas o commits sueltos')}>{t('en ninguna rama')}</span>
            ) : (
              <button className={`chip${branchesOpen ? ' chip--open' : ''}`} onClick={() => setBranchesOpen((o) => !o)} aria-expanded={branchesOpen} title={branches.join('\n')}>
                <GitBranch size={12} strokeWidth={1.75} aria-hidden />
                {tn(branches.length, 'en {n} rama', 'en {n} ramas')}
                <ChevronDown size={12} strokeWidth={2} className={`chevron-down${branchesOpen ? ' chevron-down--open' : ''}`} aria-hidden />
              </button>
            )}
          </div>
        )}
        {prefs.facts && branchesOpen && branches && branches.length > 0 && (
          <div className="details__branches">
            {branches.map((name) => (
              <button key={name} className="chip" onClick={() => onSelectBranch(name)} title={t('Ir al commit de {name}', { name })}>
                <GitBranch size={12} strokeWidth={1.75} aria-hidden />
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="details__files-header" title={isMerge ? t('Cambios respecto del primer padre (la rama en la que se fusionó)') : undefined}>
        <strong>
          {tn(details.files.length, '{n} archivo', '{n} archivos')}
        </strong>
        <span className="added">+{additions}</span>
        <span className="deleted">−{deletions}</span>
        <div className="segmented segmented--tiny details__view" role="radiogroup" aria-label={t('Ver los archivos')}>
          <button
            role="radio"
            aria-checked={prefs.files === 'tree'}
            className={`segmented__item${prefs.files === 'tree' ? ' segmented__item--active' : ''}`}
            title={t('En árbol de carpetas')}
            onClick={() => setDetailsPrefs({ files: 'tree' })}
          >
            <FolderTree size={13} strokeWidth={1.75} aria-label={t('Árbol')} />
          </button>
          <button
            role="radio"
            aria-checked={prefs.files === 'list'}
            className={`segmented__item${prefs.files === 'list' ? ' segmented__item--active' : ''}`}
            title={t('En lista, con la ruta completa')}
            onClick={() => setDetailsPrefs({ files: 'list' })}
          >
            <List size={13} strokeWidth={1.75} aria-label={t('Lista')} />
          </button>
        </div>
      </div>
      <div className="details__files">
        <FileTree
          nodes={nodes}
          selectedPath={selectedPath}
          collapsed={collapsed}
          onSelect={(change) => onOpenFile(change, details)}
          onToggleFolder={(path) =>
            setCollapsed((prev) => {
              const next = new Set(prev)
              if (next.has(path)) next.delete(path)
              else next.add(path)
              return next
            })
          }
        />
      </div>
    </div>
  )
}

function BranchLink({ name, onSelect }: { name: string; onSelect(name: string): void }) {
  return (
    <button className="link link--branch" onClick={() => onSelect(name)} title={t('Ir al commit de {name}', { name })}>
      {name}
    </button>
  )
}
