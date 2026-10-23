import { useState } from 'react'
import { useAvatarUrl } from '../lib/avatars'
import { hueFor, initials } from '../lib/format'

interface Props {
  name: string
  /** Con email se busca la foto (GitHub o Gravatar); si no hay, quedan las iniciales. */
  email?: string
  size?: number
}

/** Foto del autor como en GitKraken, con iniciales de respaldo y un color fijo por persona. */
export function Avatar({ name, email, size = 20 }: Props) {
  const url = useAvatarUrl(email)
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = url && failed !== url
  return (
    <span
      className="avatar"
      title={email ? `${name} <${email}>` : name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `hsl(${hueFor(name)} 38% 46%)` }}
    >
      {initials(name)}
      {showImage && (
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          width={size}
          height={size}
          onError={() => setFailed(url)}
        />
      )}
    </span>
  )
}
