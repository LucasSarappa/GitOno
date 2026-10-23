import { ArrowRight, GitBranch, GitBranchPlus, GitCompareArrows, GitMerge, Sparkles, X } from 'lucide-react'
import type { BranchInsight } from '../../../shared/types'
import { absoluteDate, relativeDate, shortSha } from '../lib/format'

interface Props {
  /** Nombre de la rama elegida (se muestra mientras se calcula el linaje). */
  name: string
  insight: BranchInsight | null
  onGoTo(sha: string): void
  onCompare(baseRef: string, ref: string): void
  onClose(): void
}

/** Resumen del linaje de la rama elegida: de dónde sale, qué tiene y dónde se mergeó. */
export function BranchInsightCard({ name, insight, onGoTo, onCompare, onClose }: Props) {
  return (
    <section className="insight glass" aria-label={`Linaje de ${name}`}>
      <div className="insight__title">
        <GitBranch size={15} strokeWidth={1.75} aria-hidden />
        <strong>{name}</strong>
      </div>

      {!insight ? (
        <span className="insight__fact text-2">Buscando de dónde sale…</span>
      ) : insight.isBase ? (
        <span className="insight__fact text-2">Rama principal del repo: las demás se miden contra esta.</span>
      ) : !insight.base ? (
        <span className="insight__fact text-2">No se encontró una rama principal (main, master o develop) para comparar.</span>
      ) : (
        <>
          {insight.forkPoint && (
            <button className="insight__fact insight__fact--link" onClick={() => onGoTo(insight.forkPoint!)} title="Ir al commit de origen">
              <GitBranchPlus size={14} strokeWidth={1.75} aria-hidden />
              Sale de <strong>{insight.base.name}</strong> en <code>{shortSha(insight.forkPoint)}</code>
              <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          {insight.created && (
            <span className="insight__fact text-2" title={absoluteDate(insight.created.date)}>
              <Sparkles size={14} strokeWidth={1.75} aria-hidden />
              Creada desde <strong>{insight.created.from}</strong> {relativeDate(insight.created.date)}
            </span>
          )}
          <span className="insight__fact">
            {insight.ownCount === 1 ? '1 commit propio' : `${insight.ownCount.toLocaleString('es-AR')} commits propios`}
            {insight.behind > 0 && !insight.merge && (
              <span className="text-2"> · {insight.behind.toLocaleString('es-AR')} atrás de {insight.base.name}</span>
            )}
          </span>
          {insight.merge?.kind === 'merge-commit' ? (
            <button className="insight__fact insight__fact--link insight__fact--merged" onClick={() => onGoTo((insight.merge as { sha: string }).sha)} title={insight.merge.subject}>
              <GitMerge size={14} strokeWidth={1.75} aria-hidden />
              Mergeada en <strong>{insight.base.name}</strong> en <code>{shortSha(insight.merge.sha)}</code>
              <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
            </button>
          ) : insight.merge?.kind === 'fast-forward' ? (
            <span className="insight__fact insight__fact--merged">
              <GitMerge size={14} strokeWidth={1.75} aria-hidden />
              Integrada en <strong>{insight.base.name}</strong> por avance rápido (fast-forward)
            </span>
          ) : (
            <span className="insight__fact text-2">Sin mergear en {insight.base.name}</span>
          )}
        </>
      )}

      <div className="insight__actions">
        {insight?.base && !insight.isBase && (
          <button className="btn btn--sm" onClick={() => onCompare(insight.base!.ref, insight.ref)}>
            <GitCompareArrows size={14} strokeWidth={1.75} aria-hidden />
            Comparar con {insight.base.name}
          </button>
        )}
        <button className="btn btn--icon btn--ghost btn--sm" onClick={onClose} aria-label="Dejar de resaltar la rama" title="Dejar de resaltar (Esc)">
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    </section>
  )
}
