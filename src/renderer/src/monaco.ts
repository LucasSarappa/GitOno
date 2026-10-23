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

// Temas del editor con la paleta de la app (styles.css): crema en claro, cacao en oscuro.
monaco.editor.defineTheme('gitono-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#fbf7f2',
    'editorGutter.background': '#fbf7f2',
    'editorLineNumber.foreground': '#a8968a',
    'editorLineNumber.activeForeground': '#66544a',
    'editor.selectionBackground': '#e9c79f80',
    'editor.lineHighlightBackground': '#f3ebe2',
    'diffEditor.insertedLineBackground': '#2f8a5714',
    'diffEditor.insertedTextBackground': '#2f8a5733',
    'diffEditor.removedLineBackground': '#c2453a14',
    'diffEditor.removedTextBackground': '#c2453a33',
    'diffEditor.diagonalFill': '#d9c8b866',
    'scrollbarSlider.background': '#5438241f',
    'scrollbarSlider.hoverBackground': '#54382438'
  }
})
monaco.editor.defineTheme('gitono-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#211a16',
    'editorGutter.background': '#211a16',
    'editorLineNumber.foreground': '#7d6a5c',
    'editorLineNumber.activeForeground': '#c4b2a3',
    'editor.selectionBackground': '#e2a26a40',
    'editor.lineHighlightBackground': '#2a221d',
    'diffEditor.insertedLineBackground': '#63c58f14',
    'diffEditor.insertedTextBackground': '#63c58f30',
    'diffEditor.removedLineBackground': '#f0786c14',
    'diffEditor.removedTextBackground': '#f0786c30',
    'diffEditor.diagonalFill': '#3a2e2666',
    'scrollbarSlider.background': '#ffe4c81f',
    'scrollbarSlider.hoverBackground': '#ffe4c838'
  }
})

/** Tema del editor según el tema de la app (lo llama lib/appearance.tsx). */
export function setMonacoTheme(dark: boolean): void {
  monaco.editor.setTheme(dark ? 'gitono-dark' : 'gitono-light')
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
