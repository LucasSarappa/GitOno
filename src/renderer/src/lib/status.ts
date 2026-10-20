import type { ChangeStatus } from '../../../shared/types'

interface StatusMeta {
  symbol: string
  label: string
  /** Clase CSS que define el color. */
  tone: 'added' | 'deleted' | 'modified' | 'renamed'
}

// Se evitan las letras A/M/D de Git para no confundirlas con "rama A" y "rama B".
export const STATUS_META: Record<ChangeStatus, StatusMeta> = {
  added: { symbol: '+', label: 'Solo en B (archivo nuevo)', tone: 'added' },
  deleted: { symbol: '−', label: 'Solo en A (no está en B)', tone: 'deleted' },
  modified: { symbol: '~', label: 'Modificado', tone: 'modified' },
  renamed: { symbol: '→', label: 'Renombrado', tone: 'renamed' },
  copied: { symbol: '⧉', label: 'Copiado', tone: 'renamed' },
  'type-changed': { symbol: 'T', label: 'Cambió el tipo de archivo', tone: 'modified' },
  unknown: { symbol: '?', label: 'Otro cambio', tone: 'modified' }
}
