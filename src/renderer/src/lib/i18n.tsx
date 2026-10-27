// Traducciones con partes que son elementos (negritas, código, enlaces): tr('Sale de {base}', { base: <strong>…</strong> }).
// El texto se traduce entero con t() y recién después se reemplazan las variables por los elementos.

import { Fragment, type ReactNode } from 'react'
import { t } from '../../../shared/i18n'

export function tr(text: string, parts: Record<string, ReactNode>): ReactNode {
  return t(text)
    .split(/\{(\w+)\}/)
    .map((piece, i) => <Fragment key={i}>{i % 2 === 1 ? (piece in parts ? parts[piece] : `{${piece}}`) : piece}</Fragment>)
}
