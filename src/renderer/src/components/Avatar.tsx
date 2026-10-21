import { hueFor, initials } from '../lib/format'

/** Avatar con iniciales y un color fijo por persona (sin pedir imágenes a internet). */
export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      title={name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `hsl(${hueFor(name)} 50% 42%)` }}
    >
      {initials(name)}
    </span>
  )
}
