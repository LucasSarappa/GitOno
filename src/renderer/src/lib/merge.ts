export interface MergeDescription {
  /** Rama que se mergeó. */
  from: string
  /** Rama en la que se mergeó, si el mensaje lo dice. */
  into: string | null
  /** Número de pull request o merge request, si vino de uno. */
  request: number | null
}

const PATTERNS: { regex: RegExp; read(m: RegExpExecArray): MergeDescription }[] = [
  // GitHub: "Merge pull request #12 from usuario/rama"
  {
    regex: /^Merge pull request #(\d+) from (\S+)/,
    read: (m) => ({ from: m[2].replace(/^[^/]+\//, ''), into: null, request: Number(m[1]) })
  },
  // Git y GitLab: "Merge branch 'x' into 'main'", "Merge branch 'x' of https://… into main"
  {
    regex: /^Merge (?:remote-tracking )?branch '([^']+)'(?: of \S+)?(?: into '?([^'\s]+)'?)?/,
    read: (m) => ({ from: m[1], into: m[2] ?? null, request: null })
  },
  // GitLab con merge request: "Merge branch 'x' into 'main'\n\nSee merge request grupo/repo!34" (solo el resumen)
  {
    regex: /^Merge (?:tag )?'([^']+)'(?: into '?([^'\s]+)'?)?/,
    read: (m) => ({ from: m[1], into: m[2] ?? null, request: null })
  }
]

/** Lee el mensaje de un commit de merge para decir qué rama se mergeó y en cuál. */
export function describeMerge(subject: string): MergeDescription | null {
  for (const { regex, read } of PATTERNS) {
    const match = regex.exec(subject)
    if (match) return read(match)
  }
  return null
}
