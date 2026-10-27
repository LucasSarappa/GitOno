import type { ChangeStatus } from '../../../shared/types'
import { t } from '../../../shared/i18n'

interface StatusMeta {
  symbol: string
  label: string
  /** Clase CSS que define el color. */
  tone: 'added' | 'deleted' | 'modified' | 'renamed'
}

// Se evitan las letras A/M/D de Git para no confundirlas con "rama A" y "rama B".
export const STATUS_META: Record<ChangeStatus, StatusMeta> = {
  added: { symbol: '+', label: t('Solo en B (archivo nuevo)'), tone: 'added' },
  deleted: { symbol: '−', label: t('Solo en A (no está en B)'), tone: 'deleted' },
  modified: { symbol: '~', label: t('Modificado'), tone: 'modified' },
  renamed: { symbol: '→', label: t('Renombrado'), tone: 'renamed' },
  copied: { symbol: '⧉', label: t('Copiado'), tone: 'renamed' },
  'type-changed': { symbol: 'T', label: t('Cambió el tipo de archivo'), tone: 'modified' },
  unknown: { symbol: '?', label: t('Otro cambio'), tone: 'modified' }
}
