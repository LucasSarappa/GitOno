// Avatares de los autores: cada componente pide el suyo y los pedidos se juntan en uno solo
// al proceso principal (que decide entre GitHub y Gravatar, ver src/main/avatars.ts).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ProviderInfo } from '../../../shared/types'
import { api } from '../api'
import { useAppearance } from './appearance'

interface AvatarState {
  urls: Readonly<Record<string, string>>
  request(email: string): void
}

const AvatarContext = createContext<AvatarState>({ urls: {}, request: () => undefined })

interface Props {
  root: string
  provider: ProviderInfo | null
  children: ReactNode
}

export function AvatarProvider({ root, provider, children }: Props) {
  const { appearance } = useAppearance()
  const [urls, setUrls] = useState<Record<string, string>>({})
  const pending = useRef(new Set<string>())
  const requested = useRef(new Set<string>())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const flush = useCallback(() => {
    timer.current = undefined
    const emails = [...pending.current]
    pending.current.clear()
    if (emails.length === 0) return
    api.resolveAvatars(root, emails, provider).then(
      (found) => setUrls((prev) => ({ ...prev, ...found })),
      () => undefined // sin avatares se muestran las iniciales
    )
  }, [root, provider])

  const request = useCallback(
    (email: string) => {
      if (!appearance.avatars || !email || requested.current.has(email)) return
      requested.current.add(email)
      pending.current.add(email)
      // Se esperan unos milisegundos para juntar todos los emails de las filas visibles.
      timer.current ??= setTimeout(flush, 40)
    },
    [appearance.avatars, flush]
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  const value = useMemo(() => ({ urls: appearance.avatars ? urls : {}, request }), [urls, request, appearance.avatars])
  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>
}

/** URL del avatar de un email, o undefined mientras no se conoce (o si están desactivados). */
export function useAvatarUrl(email: string | undefined): string | undefined {
  const { urls, request } = useContext(AvatarContext)
  useEffect(() => {
    if (email) request(email)
  }, [email, request])
  return email ? urls[email] : undefined
}
