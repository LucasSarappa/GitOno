/** Una operación que se puede deshacer y volver a hacer (como Ctrl+Z en GitKraken). */
export interface UndoEntry {
  /** Qué se hizo, en infinitivo: "crear la rama feature". Se usa en "Deshacer: …". */
  label: string
  undo(): Promise<void>
  redo(): Promise<void>
}

/** Cuántas operaciones se recuerdan por repo. */
const LIMIT = 50

/** Historial de operaciones de un repo: lo hecho y lo deshecho (para rehacer). */
export class UndoStack {
  private done: UndoEntry[] = []
  private undone: UndoEntry[] = []

  /** Una operación nueva borra lo que se podía rehacer, como en cualquier editor. */
  push(entry: UndoEntry): void {
    this.done.push(entry)
    if (this.done.length > LIMIT) this.done.shift()
    this.undone = []
  }

  get nextUndo(): UndoEntry | null {
    return this.done.at(-1) ?? null
  }

  get nextRedo(): UndoEntry | null {
    return this.undone.at(-1) ?? null
  }

  /** Deshace la última. Si falla, queda donde estaba para poder reintentar. */
  async undo(): Promise<UndoEntry | null> {
    const entry = this.done.at(-1)
    if (!entry) return null
    await entry.undo()
    this.done.pop()
    this.undone.push(entry)
    return entry
  }

  async redo(): Promise<UndoEntry | null> {
    const entry = this.undone.at(-1)
    if (!entry) return null
    await entry.redo()
    this.undone.pop()
    this.done.push(entry)
    return entry
  }

  clear(): void {
    this.done = []
    this.undone = []
  }
}
