import { Check, Copy, GitBranch, GitMerge } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CommitDetails as Details, FileChange } from '../../../shared/types'
import { api } from '../api'
import { absoluteDate, relativeDate, shortSha } from '../lib/format'
import { describeMerge } from '../lib/merge'
import { buildTree } from '../lib/tree'
import { Avatar } from './Avatar'
import { FileTree } from './FileTree'

type LoadState = { status: 'loading' } | { status: 'ready'; details: Details } | { status: 'error'; message: string }

/** Cuántas ramas se nombran antes de resumir el resto ("y 12 más"). */
const MAX_BRANCHES = 6

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

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setCopied(false)
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

  if (state.status === 'loading') return <div className="details details--empty text-2">Cargando…</div>
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
    void api.copyText(details.sha).then(() => setCopied(true))
  }

  return (
    <div className="details">
      <div className="details__header">
        <h2 className="details__subject">{details.subject}</h2>
        {body && <p className="details__body">{body}</p>}
        {isMerge && (
          <p className="details__merge">
            <GitMerge size={14} strokeWidth={1.75} aria-hidden />
            {merge ? (
              <span>
                Merge de <BranchLink name={merge.from} onSelect={onSelectBranch} />
                {merge.into && (
                  <>
                    {' '}
                    en <BranchLink name={merge.into} onSelect={onSelectBranch} />
                  </>
                )}
                {merge.request !== null && <span className="text-2"> · pull request #{merge.request}</span>}
              </span>
            ) : (
              <span>
                Une <code>{shortSha(details.parents[1])}</code> en <code>{shortSha(details.parents[0])}</code>
              </span>
            )}
          </p>
        )}
      </div>

      <div className="details__meta">
        <div className="details__person">
          <Avatar name={details.authorName} email={details.authorEmail} size={32} />
          <div>
            <div className="details__author">
              <strong>{details.authorName}</strong> <span className="text-2 small">{details.authorEmail}</span>
            </div>
            <div className="text-2 small" title={absoluteDate(details.authorDate)}>
              {absoluteDate(details.authorDate)} · {relativeDate(details.authorDate)}
            </div>
          </div>
        </div>
        {committedBySomeoneElse && (
          <div className="text-2 small">
            Commit hecho por {details.committerName} el {absoluteDate(details.committerDate)}
          </div>
        )}

        <dl className="details__facts">
          <dt>SHA</dt>
          <dd className="details__sha">
            <code title={details.sha}>{details.sha}</code>
            <button className="btn btn--icon btn--ghost btn--sm" onClick={copySha} aria-label="Copiar SHA" title={copied ? 'Copiado' : 'Copiar SHA'}>
              {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
            </button>
          </dd>
          <dt>{isMerge ? 'Padres' : 'Padre'}</dt>
          <dd>
            {details.parents.length === 0 ? (
              <span className="text-2">Primer commit del repositorio</span>
            ) : (
              details.parents.map((parent) => (
                <button key={parent} className="link" onClick={() => onSelectCommit(parent)} title={parent}>
                  {shortSha(parent)}
                </button>
              ))
            )}
          </dd>
          <dt>En ramas</dt>
          <dd className="details__branches">
            {branches === null ? (
              <span className="text-2">…</span>
            ) : branches.length === 0 ? (
              <span className="text-2">Ninguna (solo en tags o commits sueltos)</span>
            ) : (
              <>
                {branches.slice(0, MAX_BRANCHES).map((name) => (
                  <button key={name} className="chip" onClick={() => onSelectBranch(name)} title={`Ver de dónde sale ${name}`}>
                    <GitBranch size={12} strokeWidth={1.75} aria-hidden />
                    {name}
                  </button>
                ))}
                {branches.length > MAX_BRANCHES && (
                  <span className="text-2 small" title={branches.slice(MAX_BRANCHES).join('\n')}>
                    y {branches.length - MAX_BRANCHES} más
                  </span>
                )}
              </>
            )}
          </dd>
        </dl>
      </div>

      <div className="details__files-header">
        <strong>
          {details.files.length} {details.files.length === 1 ? 'archivo' : 'archivos'}
        </strong>
        <span className="added">+{additions}</span>
        <span className="deleted">−{deletions}</span>
        {isMerge && <span className="text-2 small">respecto del primer padre</span>}
      </div>
      <div className="details__files">
        <FileTree
          nodes={tree}
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
    <button className="link link--branch" onClick={() => onSelect(name)} title={`Ver de dónde sale ${name}`}>
      {name}
    </button>
  )
}
