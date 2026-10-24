// Búsqueda difusa para la paleta de comandos: "chk main" encuentra "Checkout de main". Las letras
// tienen que aparecer en orden; suman las que van seguidas y las que empiezan una palabra.

/** Sin tildes y en minúscula, para que "accion" encuentre "acción". */
const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Puntaje de `query` dentro de `text`, o null si no coincide. Más alto es mejor. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = plain(query).replace(/\s+/g, '')
  if (!q) return 0
  const t = plain(text)
  let score = 0
  let from = 0
  let previous = -2
  for (const char of q) {
    const at = t.indexOf(char, from)
    if (at === -1) return null
    if (at === previous + 1) score += 5 // seguida de la anterior
    if (at === 0 || /[\s/:._-]/.test(t[at - 1])) score += 8 // empieza una palabra
    score += 1
    previous = at
    from = at + 1
  }
  // A igual coincidencia, gana el texto más corto (más preciso).
  return score - t.length * 0.05
}

/** Filtra y ordena por puntaje; sin búsqueda deja el orden original. */
export function fuzzyFilter<T>(items: T[], query: string, text: (item: T) => string): T[] {
  if (!query.trim()) return items
  return items
    .map((item) => ({ item, score: fuzzyScore(query, text(item)) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item)
}
