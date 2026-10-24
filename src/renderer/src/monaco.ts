// Configuración de Monaco, el editor de VS Code, que usamos como visor de diferencias.
// Se carga desde node_modules (nada de CDN), así la app funciona sin internet.

// Textos del editor en español. Tiene que ser el primer import: Monaco lee las traducciones al cargarse.
import 'monaco-editor/nls/lang/es'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import type { ThemeColors } from './lib/themes'

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  }
}

// Es un visor de solo lectura: sin validaciones, que llenarían el diff de subrayados rojos
// (por ejemplo, imports que Monaco no puede resolver).
monaco.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true })
monaco.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true })
monaco.json.jsonDefaults.setDiagnosticsOptions({ validate: false })
monaco.css.cssDefaults.setOptions({ validate: false })
monaco.css.scssDefaults.setOptions({ validate: false })
monaco.css.lessDefaults.setOptions({ validate: false })

// Tema del editor armado con los colores del tema de la app (lib/themes.ts), así sigue también
// los colores que cambie el usuario. Monaco pide colores #rrggbb o #rrggbbaa.
const alpha = (hex: string, amount: number) => hex + Math.round(amount * 255).toString(16).padStart(2, '0')

/** Aplica el tema del editor (lo llama lib/appearance.tsx cada vez que cambian los colores). */
export function setMonacoTheme(colors: ThemeColors, dark: boolean): void {
  monaco.editor.defineTheme('gitono', {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': colors.panel,
      'editor.foreground': colors.text,
      'editorGutter.background': colors.panel,
      'editorLineNumber.foreground': alpha(colors.text3, 0.75),
      'editorLineNumber.activeForeground': colors.text2,
      'editor.selectionBackground': alpha(colors.accent, dark ? 0.3 : 0.25),
      'editor.lineHighlightBackground': alpha(colors.text, 0.04),
      'diffEditor.insertedLineBackground': alpha(colors.added, 0.09),
      'diffEditor.insertedTextBackground': alpha(colors.added, 0.2),
      'diffEditor.removedLineBackground': alpha(colors.deleted, 0.09),
      'diffEditor.removedTextBackground': alpha(colors.deleted, 0.2),
      'diffEditor.diagonalFill': alpha(colors.text3, 0.25),
      'scrollbarSlider.background': alpha(colors.text, 0.12),
      'scrollbarSlider.hoverBackground': alpha(colors.text, 0.22)
    }
  })
  monaco.editor.setTheme('gitono')
}

/** Elige el resaltado de sintaxis según el nombre o la extensión del archivo. */
export function languageFor(path: string): string {
  const fileName = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
  const dot = fileName.lastIndexOf('.')
  const extension = dot > 0 ? fileName.slice(dot) : ''
  const languages = monaco.languages.getLanguages()
  const byName = languages.find((l) => l.filenames?.some((f) => f.toLowerCase() === fileName))
  if (byName) return byName.id
  const byExtension = extension && languages.find((l) => l.extensions?.some((e) => e.toLowerCase() === extension))
  return byExtension ? byExtension.id : 'plaintext'
}

export { monaco }
