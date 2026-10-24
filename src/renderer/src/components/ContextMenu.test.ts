import { describe, expect, it } from 'vitest'
import { tidy, type MenuItem } from './ContextMenu'

const item = (label: string): MenuItem => ({ label, onSelect: () => undefined })
const separator: MenuItem = { kind: 'separator' }

describe('tidy', () => {
  it('saca lo que no corresponde y los separadores que sobran', () => {
    const result = tidy([
      { kind: 'label', label: 'Rama main' },
      separator,
      item('a'),
      false,
      separator,
      separator,
      null,
      item('b'),
      separator,
      undefined
    ])
    expect(result.map((i) => (i.kind === 'separator' ? '—' : 'label' in i ? i.label : ''))).toEqual(['Rama main', 'a', '—', 'b'])
  })

  it('un menú sin ítems queda vacío', () => {
    expect(tidy([separator, false, separator])).toEqual([])
  })
})
