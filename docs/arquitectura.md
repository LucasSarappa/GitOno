# Arquitectura de GitOno

## Tecnologías

| Parte | Elección | Por qué |
|---|---|---|
| App de escritorio | Electron | Todo el proyecto en TypeScript; acceso a Git y al sistema de archivos. |
| Compilación | electron-vite (Vite) | Un solo comando para los tres procesos de Electron, con recarga en caliente. |
| Interfaz | React | Componentes simples y ecosistema conocido. |
| Visor de diferencias | Monaco Editor | Es el editor de VS Code: diff lado a lado, resaltado de sintaxis, textos en español. Se carga desde `node_modules`, sin CDN, así funciona sin internet. |
| Git | El `git` instalado en la máquina | Es la implementación de referencia: soporta todo (renombres, LFS, credenciales) sin reimplementar nada. |
| Tests | Vitest | Rápido y compatible con Vite. |

## Los tres procesos de Electron

```mermaid
flowchart LR
  subgraph Interfaz["Interfaz (renderer, React)"]
    UI[App.tsx y componentes]
  end
  subgraph Puente["Preload"]
    API["window.gitono"]
  end
  subgraph Principal["Proceso principal (Node)"]
    IPC[ipc.ts]
    CORE["Núcleo Git<br/>git/repo.ts"]
    PROV["Adaptadores<br/>providers/"]
  end
  GIT[(git.exe)]

  UI --> API -->|IPC| IPC --> CORE --> GIT
  CORE --> PROV
```

- **Interfaz (renderer):** React. No tiene acceso a Node ni al disco; solo puede llamar a `window.gitono`.
- **Preload:** expone una API chica y tipada (`GitOnoApi` en `src/shared/types.ts`) usando `contextBridge`.
- **Proceso principal:** recibe los pedidos por IPC, ejecuta Git y devuelve el resultado.

Los errores viajan como `{ ok: false, error }` y el preload los vuelve a lanzar como `Error` con un mensaje legible, así la interfaz los muestra tal cual.

### Seguridad

- `contextIsolation: true`, `nodeIntegration: false` y `sandbox: true`: la interfaz no puede ejecutar código de Node.
- Política de seguridad de contenido (CSP) en `index.html`: solo se cargan scripts propios.
- Git se ejecuta con `execFile` (sin shell) y cada referencia se valida con `assertSafeRef`, para que un nombre como `--output=x` no se interprete como una opción.
- Los links externos se abren en el navegador del sistema, nunca dentro de la app.

## Capas del proceso principal

### Núcleo Git (`src/main/git/`)

Todo lo que funciona igual con cualquier plataforma. No depende de Electron, así que se puede testear con Node puro.

| Función | Comando Git | Para qué |
|---|---|---|
| `openRepo` | `git rev-parse --show-toplevel`, `git remote get-url` | Encontrar la raíz del repo y su remoto. |
| `listRefs` | `git for-each-ref refs/heads refs/remotes refs/tags` | Listar ramas y tags con el commit al que apunta cada uno. |
| `listRefs` | `git symbolic-ref -q HEAD`, `git rev-parse HEAD^{commit}` | Saber en qué rama y en qué commit está parado el repo. |
| `listCommits` | `git log --branches --remotes --tags HEAD --date-order` | Historial para el gráfico, por tandas (`--max-count`). |
| `commitDetails` | `git show -s SHA^{commit}` | Mensaje completo, autor y quién hizo el commit. |
| `commitDetails` | `git diff-tree -r -z -M PADRE SHA` (o `--root SHA`) | Archivos que cambió el commit, respecto de su primer padre. |
| `compareRefs` | `git diff --name-status -z -M A B` | Archivos cambiados y su estado (con detección de renombres). |
| `compareRefs` | `git diff --numstat -z -M A B` | Líneas agregadas y borradas, y qué archivos son binarios. |
| `compareRefs` | `git rev-list --left-right --count A...B` | Cuántos commits tiene cada rama que la otra no. |
| `readFileAtRef` | `git cat-file -s` y `git cat-file blob A:ruta` | Leer un archivo tal como está en una rama, sin checkout. |
| `fetchAll` | `git fetch --all --prune` | Traer ramas nuevas del servidor. |

Decisiones:

- **Se compara A contra B directamente** (`git diff A B`), no contra el ancestro común. La pregunta que responde es "¿en qué se diferencian hoy estas dos ramas?", como comparar dos carpetas.
- **Se usan nombres completos** (`refs/heads/main`) al hablar con Git; los cortos (`main`) solo se muestran. Así no hay ambigüedad si una rama y un tag se llaman igual.
- **Salida con `-z`** (separador NUL): las rutas con espacios, tildes o caracteres especiales llegan tal cual, sin comillas ni escapes.
- **Archivos binarios:** si hay un byte NUL al principio se tratan como binarios (mismo criterio que Git) y no se muestran como texto.
- **Archivos grandes:** más de 5 MB no se cargan en el visor (`MAX_FILE_BYTES`).
- **Credenciales:** `fetch` usa el Git Credential Manager que trae Git para Windows. Se desactiva el pedido de contraseña por terminal (`GIT_TERMINAL_PROMPT=0`) porque la app no tiene terminal.
- **Historial:**
  - se usa `--date-order`, que muestra los hijos siempre antes que sus padres y respeta la fecha, como GitKraken;
  - en vez de `--all` se listan ramas, remotas, tags y HEAD, para que los stashes no aparezcan como commits sueltos;
  - `--no-show-signature` evita que la verificación de firmas GPG se mezcle con la salida si el usuario la tiene activada.
- **Detalle de un commit:**
  - se pide `SHA^{commit}` para que también funcione si llega el SHA de un tag anotado;
  - los merges se comparan contra su primer padre, igual que GitKraken y GitHub.

### Adaptadores de plataforma (`src/main/providers/`)

Cada plataforma implementa la interfaz `GitProvider` (`providers/types.ts`). El resto de la app solo conoce esa interfaz.

- `remote-url.ts` entiende las URLs de remoto (`https://`, `ssh://` y `git@host:ruta`) y extrae el host y la ruta del repo (incluidos los subgrupos de GitLab).
- `github.ts` y `gitlab.ts` deciden si un host les pertenece. GitLab también reconoce instancias propias con "gitlab" en el dominio (por ejemplo `gitlab.empresa.com`).
- Si ningún adaptador reconoce el host, el repo se marca como `generic`: todo lo local funciona igual.

Hoy los adaptadores solo identifican la plataforma. En la etapa de plataformas ([hoja de ruta](roadmap.md), etapa 5) la interfaz va a sumar operaciones contra la API de cada una, con la misma firma para todas:

```ts
listBranches(repo): Promise<Branch[]>
compare(repo, base, head): Promise<FileChange[]>
getFile(repo, ref, path): Promise<string>
listChangeRequests(repo): Promise<ChangeRequest[]> // PR en GitHub, MR en GitLab
```

#### Cómo sumar una plataforma nueva

1. Crear `src/main/providers/<plataforma>.ts` que exporte un objeto `GitProvider`.
2. Agregarlo a la lista `providers` en `src/main/providers/index.ts`.
3. Sumar casos en `providers.test.ts`.

## Interfaz (`src/renderer/src/`)

- `App.tsx`: repo abierto, referencias, pestañas, botón de fetch y avisos de error. Las dos vistas quedan montadas (se ocultan con `hidden`), así al cambiar de pestaña no se pierde lo que estabas mirando. Cuando cambia `reloadKey` (después de un fetch), las vistas vuelven a leer Git.
- `views/HistoryView.tsx`: pestaña Historial. Panel de ramas, lista de commits, búsqueda, detalle y diff de un archivo del commit.
- `views/CompareView.tsx`: pestaña Comparar ramas.
- `components/CommitList.tsx`: lista de commits **virtualizada**. Solo dibuja las filas visibles (más un margen), así 20.000 commits se mueven igual de rápido que 20. Al acercarse al final pide otra tanda de 1.000.
- `components/CommitGraphCell.tsx`: el gráfico de una fila, en SVG.
- `components/RefsPanel.tsx`: ramas locales, remotas agrupadas por remoto y tags.
- `components/CommitDetails.tsx`: detalle del commit elegido.
- `components/RefSelect.tsx`: selector de rama agrupado en locales, remotas y tags.
- `components/FileTree.tsx`: árbol de archivos cambiados. Las carpetas con un solo hijo se compactan (`src/main/git`), como en VS Code.
- `components/DiffView.tsx`: visor Monaco. El editor se crea una sola vez; al cambiar de archivo solo se reemplazan los modelos, así no parpadea.
- `monaco.ts`: configuración de Monaco (workers locales, idioma español, sin validaciones porque es de solo lectura, tema según Windows).
- `lib/refs.ts`: arma las etiquetas de cada commit y junta una rama local con su remota cuando apuntan al mismo commit.
- `lib/settings.ts`: preferencias guardadas (ancho del panel, opciones del diff, pestaña). Si el almacenamiento falla, se usan los valores por defecto.

Los estados de archivo usan símbolos (+, −, ~, →) en lugar de las letras de Git (A, M, D) para no confundirlos con "rama A" y "rama B".

### Cómo se dibuja el gráfico (`lib/graph.ts`)

Los commits llegan de más nuevo a más viejo. Se mantiene una lista de **carriles** (columnas), y cada carril "espera" a un commit: el próximo que va a aparecer en esa columna.

1. Si algún carril espera al commit, el commit va en el primero de ellos. Los otros carriles que también lo esperaban convergen en él con una curva, por ejemplo cuando dos ramas salieron del mismo punto.
2. Si ningún carril lo espera, es la punta de una rama: abre un carril nuevo con un color nuevo.
3. Después, el carril pasa a esperar al **primer padre** y mantiene su color. Los otros padres (en un merge) se suman a un carril que ya los esperaba, o abren uno nuevo.
4. Los carriles que quedan libres se reutilizan, y los vacíos del final se recortan para que el gráfico no crezca de más.

Cada fila guarda sus líneas en dos mitades: de arriba al nodo y del nodo hacia abajo. Así cada fila se dibuja sola, que es lo que necesita la lista virtualizada. El cálculo es lineal en la cantidad de commits: 20.000 se procesan al instante.

## Tests

- `git/parse.test.ts`: parsers de la salida de Git.
- `git/repo.test.ts`: crea un repo real en una carpeta temporal, con dos ramas, y prueba el núcleo completo (renombres, binarios, archivos borrados, referencias inválidas).
- `git/log.test.ts`: historial y detalle de commits contra un repo real con merge y tag anotado. Prueba el orden, los límites, el primer commit, los merges y los repos vacíos. Usa fechas fijas para que el orden sea predecible.
- `providers/providers.test.ts`: lectura de URLs y detección de plataforma.
- `renderer/src/lib/graph.test.ts`: carriles del gráfico (historia lineal, merges, ramas que nacen del mismo commit, carriles reutilizados).
- `renderer/src/lib/refs.test.ts`: etiquetas de cada commit.
- `renderer/src/lib/tree.test.ts`: armado del árbol de archivos.

## Distribución

- `npm run dist` compila con electron-vite y empaqueta con electron-builder (`electron-builder.yml`). Genera un instalador NSIS en `dist/`.
- **La carpeta de instalación es fija** (`%LOCALAPPDATA%\Programs\GitOno`). El desinstalador de electron-builder hace `RMDir /r` de la carpeta de instalación, y al actualizar, el instalador ejecuta primero el desinstalador de la versión anterior. Si se dejara elegir la carpeta y coincidiera con una carpeta con otros archivos (por ejemplo, la del proyecto), se borraría entera.
- Al instalador solo entra `out/` y el `package.json`. React y Monaco están en `devDependencies` porque Vite ya los incluye en `out/renderer`; así no se copian dos veces y el `app.asar` pesa unos 24 MB.
- La app empaquetada carga la interfaz desde `app.asar` con `file://`. Los workers de Monaco funcionan ahí sin configuración extra.
- El ícono sale de `build/icon.svg`. electron-builder usa `build/icon.png` (512 × 512, fondo transparente) para generar el `.ico`. Si se cambia el SVG, hay que volver a exportar el PNG.
- Sin firma digital ni actualización automática por ahora.
