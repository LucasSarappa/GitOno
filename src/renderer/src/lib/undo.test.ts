import { describe, expect, it } from 'vitest'
import { UndoStack, type UndoEntry } from './undo'

function entry(label: string, log: string[], fail = false): UndoEntry {
  return {
    label,
    undo: async () => {
      if (fail) throw new Error('falló')
      log.push(`undo ${label}`)
    },
    redo: async () => {
      log.push(`redo ${label}`)
    }
  }
}

describe('UndoStack', () => {
  it('deshace y rehace en orden', async () => {
    const log: string[] = []
    const stack = new UndoStack()
    stack.push(entry('a', log))
    stack.push(entry('b', log))
    expect(stack.nextUndo?.label).toBe('b')

    await stack.undo()
    await stack.undo()
    expect(stack.nextUndo).toBeNull()
    expect(stack.nextRedo?.label).toBe('a')

    await stack.redo()
    expect(log).toEqual(['undo b', 'undo a', 'redo a'])
    expect(stack.nextUndo?.label).toBe('a')
    expect(stack.nextRedo?.label).toBe('b')
  })

  it('una operación nueva borra lo que se podía rehacer', async () => {
    const log: string[] = []
    const stack = new UndoStack()
    stack.push(entry('a', log))
    await stack.undo()
    stack.push(entry('c', log))
    expect(stack.nextRedo).toBeNull()
  })

  it('si deshacer falla, la operación sigue disponible', async () => {
    const stack = new UndoStack()
    stack.push(entry('a', [], true))
    await expect(stack.undo()).rejects.toThrow('falló')
    expect(stack.nextUndo?.label).toBe('a')
  })
})
