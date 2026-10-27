import { ArrowRight, GitBranch, GitBranchPlus, GitCompareArrows, GitMerge, Sparkles, X } from 'lucide-react'
import type { BranchInsight } from '../../../shared/types'
import { absoluteDate, relativeDate, shortSha } from '../lib/format'
import { intlLocale, t, tn } from '../../../shared/i18n'
import { tr } from '../lib/i18n'

interface Props {
  /** Nombre de la rama elegida (se muestra mientras se calcula el linaje). */
  name: string
  insight: BranchInsight | null
  onGoTo(sha: string): void
  onCompare(baseRef: string, ref: string): void
  onClose(): void
  /** Dentro del panel de detalle: en columna y sin vidrio. */
  compact?: boolean
}

/** Resumen del linaje de la rama elegida: de dónde sale, qué tiene y dónde se mergeó. */
export function BranchInsightCard({ name, insight, onGoTo, onCompare, onClose, compact = false }: Props) {
  return (
    <section className={compact ? 'insight insight--compact' : 'insight glass'} aria-label={t('Linaje de {name}', { name })}>
      <div className="insight__title">
        <GitBranch size={15} strokeWidth={1.75} aria-hidden />
        <strong>{name}</strong>
      </div>

      {!insight ? (
        <span className="insight__fact text-2">{t('Buscando de dónde sale…')}</span>
      ) : insight.isBase ? (
        <span className="insight__fact text-2">{t('Rama principal del repo: las demás se miden contra esta.')}</span>
      ) : !insight.base ? (
        <span className="insight__fact text-2">{t('No se encontró una rama principal (main, master o develop) para comparar.')}</span>
      ) : (
        <>
          {insight.forkPoint && (
            <button className="insight__fact insight__fact--link" onClick={() => onGoTo(insight.forkPoint!)} title={t('Ir al commit de origen')}>
              <GitBranchPlus size={14} strokeWidth={1.75} aria-hidden />
              {tr('Sale de {base} en {sha}', { base: <strong>{insight.base.name}</strong>, sha: <code>{shortSha(insight.forkPoint)}</code> })}
              <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          {insight.created && (
            <span className="insight__fact text-2" title={absoluteDate(insight.created.date)}>
              <Sparkles size={14} strokeWidth={1.75} aria-hidden />
              {tr('Creada desde {from} {when}', { from: <strong>{insight.created.from}</strong>, when: relativeDate(insight.created.date) })}
            </span>
          )}
          <span className="insight__fact">
            {tn(insight.ownCount, '{n} commit propio', '{n} commits propios')}
            {insight.behind > 0 && !insight.merge && (
              <span className="text-2"> · {t('{n} atrás de {base}', { n: insight.behind.toLocaleString(intlLocale()), base: insight.base.name })}</span>
            )}
          </span>
          {insight.merge?.kind === 'merge-commit' ? (
            <button className="insight__fact insight__fact--link insight__fact--merged" onClick={() => onGoTo((insight.merge as { sha: string }).sha)} title={insight.merge.subject}>
              <GitMerge size={14} strokeWidth={1.75} aria-hidden />
              {tr('Fusionada en {base} en {sha}', { base: <strong>{insight.base.name}</strong>, sha: <code>{shortSha(insight.merge.sha)}</code> })}
              <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
            </button>
          ) : insight.merge?.kind === 'fast-forward' ? (
            <span className="insight__fact insight__fact--merged">
              <GitMerge size={14} strokeWidth={1.75} aria-hidden />
              {tr('Integrada en {base} por avance rápido', { base: <strong>{insight.base.name}</strong> })}
            </span>
          ) : (
            <span className="insight__fact text-2">{t('Sin fusionar en {base}', { base: insight.base.name })}</span>
          )}
        </>
      )}

      <div className="insight__actions">
        {insight?.base && !insight.isBase && (
          <button className="btn btn--sm" onClick={() => onCompare(insight.base!.ref, insight.ref)}>
            <GitCompareArrows size={14} strokeWidth={1.75} aria-hidden />
            {t('Comparar con {base}', { base: insight.base.name })}
          </button>
        )}
        <button className="btn btn--icon btn--ghost btn--sm" onClick={onClose} aria-label={t('Dejar de resaltar la rama')} title={t('Dejar de resaltar (Esc)')}>
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    </section>
  )
}
