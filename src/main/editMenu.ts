import { Menu, type MenuItemConstructorOptions, type WebContents } from 'electron'
import { t } from '../shared/i18n'

/**
 * Menú de clic derecho para copiar y pegar texto (Electron no trae ninguno). Aparece sobre texto
 * seleccionado y en los campos editables; los menús propios de la app (ramas, commits) y el del
 * visor de diffs (Monaco) cancelan el evento y no llegan hasta acá.
 */
export function attachEditMenu(contents: WebContents): void {
  contents.on('context-menu', (_event, params) => {
    const hasSelection = params.selectionText.trim().length > 0
    if (!hasSelection && !params.isEditable) return
    const items: MenuItemConstructorOptions[] = params.isEditable
      ? [
          { role: 'cut', label: t('Cortar'), enabled: params.editFlags.canCut },
          { role: 'copy', label: t('Copiar'), enabled: params.editFlags.canCopy },
          { role: 'paste', label: t('Pegar'), enabled: params.editFlags.canPaste },
          { type: 'separator' },
          { role: 'selectAll', label: t('Seleccionar todo') }
        ]
      : [{ role: 'copy', label: t('Copiar') }]
    Menu.buildFromTemplate(items).popup()
  })
}
