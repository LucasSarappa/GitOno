import { useEffect, useMemo, useState } from 'react'
import type { CommitDetails as Details, FileChange } from '../../../shared/types'
import { api } from '../api'
import { absoluteDate, relativeDate, shortSha } from '../lib/format'
import { buildTree } from '../lib/tree'
import { Avatar } from './Avatar'
import { FileTree } from './FileTree'

type LoadState = { status: 'loading' } | { status: 'ready'; details: Details } | { status: 'error'; message: string }

interface Props {
  root: string
  sha: string
  selectedPath: string | null
  onOpenFile(change: FileChange, details: Details): void
  onSelectCommit(sha: string): void
}

/** Panel derecho del historial: mensaje, autor, padres y archivos cambiados del commit elegido. */
export function CommitDetails({ root, sha, selectedPath, onOpenFile, onSelectCommit }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
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

  const tree = useMemo(() => (state.status === 'ready' ? buildTree(state.details.files) : []), [state])

  if (state.status === 'loading') return <div className="details details--empty muted">Cargando…</div>
  if (state.status === 'error') return <div className="details details--empty error-text">{state.message}</div>

  const { details } = state
  const body = details.message.slice(details.subject.length).trim()
  const committedBySomeoneElse = details.committerEmail !== details.authorEmail || details.committerName !== details.authorName
  let additions = 0
  let deletions = 0
  for (const file of details.files) {
    additions += file.additions ?? 0
    deletions += file.deletions ?? 0
  }

  const copySha = () => {
    void navigator.clipboard.writeText(details.sha).then(() => setCopied(true))
  }

  return (
    <div className="details">
      <div className="details__header">
        <h2 className="details__subject">{details.subject}</h2>
        {body && <p className="details__body">{body}</p>}
      </div>

      <div className="details__meta">
        <div className="details__person">
          <Avatar name={details.authorName} size={28} />
          <div>
            <div>
              <strong>{details.authorName}</strong> <span className="muted small">{details.authorEmail}</span>
            </div>
            <div className="muted small" title={absoluteDate(details.authorDate)}>
              {absoluteDate(details.authorDate)} · {relativeDate(details.authorDate)}
            </div>
          </div>
        </div>
        {committedBySomeoneElse && (
          <div className="muted small">
            Commit hecho por {details.committerName} el {absoluteDate(details.committerDate)}
          </div>
        )}
        <div className="details__sha">
          <code title={details.sha}>{details.sha}</code>
          <button className="button button--small" onClick={copySha}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <div className="small">
          {details.parents.length === 0 && <span className="muted">Primer commit del repositorio</span>}
          {details.parents.length > 0 && (
            <>
              <span className="muted">{details.parents.length > 1 ? 'Padres (merge): ' : 'Padre: '}</span>
              {details.parents.map((parent) => (
                <button key={parent} className="link-button" onClick={() => onSelectCommit(parent)} title={parent}>
                  {shortSha(parent)}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="details__files-header">
        <strong>
          {details.files.length} {details.files.length === 1 ? 'archivo' : 'archivos'}
        </strong>{' '}
        <span className="added">+{additions}</span> <span className="deleted">−{deletions}</span>
        {details.parents.length > 1 && <span className="muted small"> · respecto del primer padre</span>}
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
