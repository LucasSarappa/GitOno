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

monaco.editor.defineTheme('gitono-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#ffffff' }
})
monaco.editor.defineTheme('gitono-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#1b1d21' }
})

const darkScheme = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = (): void => monaco.editor.setTheme(darkScheme.matches ? 'gitono-dark' : 'gitono-light')
applyTheme()
darkScheme.addEventListener('change', applyTheme)

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
