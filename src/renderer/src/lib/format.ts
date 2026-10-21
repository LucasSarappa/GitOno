const relativeFormat = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
const absoluteFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60]
]

/** "hace 3 días", "ayer", "hace 5 minutos". Recibe segundos desde 1970. */
export function relativeDate(seconds: number, nowSeconds = Date.now() / 1000): string {
  const diff = seconds - nowSeconds
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return relativeFormat.format(Math.round(diff / size), unit)
  }
  return 'recién'
}

export function absoluteDate(seconds: number): string {
  return absoluteFormat.format(new Date(seconds * 1000))
}

export const shortSha = (sha: string): string => sha.slice(0, 7)

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Tono de color estable para un texto (mismo autor, mismo color de avatar). */
export function hueFor(text: string): number {
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 360
}
