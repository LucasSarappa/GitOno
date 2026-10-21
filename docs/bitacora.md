# Bitácora de GitOno

Registro de lo que se hace en cada sesión: qué se construyó, qué se decidió y por qué, cómo se probó y qué quedó pendiente. Lo más nuevo va arriba.

---

## 2026-10-21 — Sesión 2: historial al estilo GitKraken (v0.2)

### La idea

Pasar de "comparador de ramas" a un cliente parecido a GitKraken, empezando por su pantalla principal: el historial con el gráfico de ramas. La lista completa de lo que falta quedó en la [hoja de ruta](roadmap.md), junto con extras propios.

### Qué se hizo

- **Núcleo Git:**
  - `listCommits`: historial de ramas, remotas, tags y HEAD, por tandas;
  - `commitDetails`: mensaje completo, autor, quién hizo el commit y archivos cambiados respecto del primer padre;
  - las referencias ahora saben a qué commit apuntan (en los tags anotados, el commit y no el objeto tag), y `listRefs` devuelve el SHA de HEAD.
- **Gráfico:** algoritmo de carriles en `lib/graph.ts` (explicado en la arquitectura). Se dibuja fila por fila en SVG, con colores por rama, nodos huecos para los merges y un anillo en HEAD.
- **Pestaña Historial:**
  - panel de ramas con filtro;
  - lista virtualizada con etiquetas de ramas y tags, avatar con iniciales, fecha relativa y SHA;
  - búsqueda con navegación entre coincidencias;
  - detalle del commit con sus archivos, que abren el diff (se vuelve con Esc).
- **Pestañas:** "Comparar ramas" pasó a su propia vista, sin cambios de funcionamiento. Las dos vistas quedan montadas para no perder lo que se estaba mirando.
- **Documentación:**
  - hoja de ruta nueva (`docs/roadmap.md`);
  - README y arquitectura actualizados;
  - versión 0.2.0.

### Decisiones

- **Orden del historial:** `--date-order`, como GitKraken.
- **Stashes fuera del gráfico:** se excluyen (no se usa `--all`). Van a tener su propia sección en la etapa 3.
- **Merges:** se muestran comparados contra su primer padre, igual que GitKraken y GitHub.
- **Avatares:** con iniciales y un color por persona. No se piden imágenes a Gravatar, así la app no hace pedidos a internet ni expone emails.
- **Etiquetas:** una rama local y su remota en el mismo commit se muestran en una sola etiqueta ("main · origin").
- **Saltos a commits no cargados:** si se elige una rama o un padre que todavía no se cargó, se sigue cargando historial (de a 5.000) hasta encontrarlo.

### Cómo se probó

- 46 tests automáticos (antes 27), entre ellos:
  - un repo real con merge y tag anotado;
  - el algoritmo del gráfico;
  - las etiquetas de cada commit.
- Typecheck y build sin errores.
- **Prueba manual en un repo de ejemplo** con ramas, merges, un tag y un remoto. Se verificó, con capturas y sin errores en la consola:
  - el gráfico;
  - el salto desde el panel de ramas;
  - el diff de un archivo y la vuelta con Esc;
  - la búsqueda;
  - la navegación con teclado;
  - los padres de un merge;
  - la pestaña Comparar.
- **Prueba de rendimiento** con un repo de 20.800 commits:
  - la lista dibuja unas 40 filas a la vez;
  - cada tanda nueva tarda unos 200 ms;
  - saltar a un tag ubicado 15.000 commits atrás tarda 0,6 s.

### Problemas encontrados y cómo se resolvieron

- **Detalle de un tag anotado:** `git show` de un tag anotado muestra el tag y no el commit. Se resolvió pidiendo siempre `SHA^{commit}`. Lo encontró el test nuevo.
- **Gráfico:** un carril recién abierto para un merge se dibujaba como si viniera de arriba. Lo encontró el test del gráfico.
- **Carga duplicada:** al llegar al final de la lista se cargaban dos tandas en vez de una, porque el pedido se repetía antes de que arrancara la carga. Ahora solo se pide más si lo cargado ya alcanzó el límite actual.
- **Detalles visuales:**
  - el título "Gráfico" quedaba cortado con un solo carril;
  - un remoto que es una carpeta local aparecía como "Sin remoto" (ahora dice "Remoto local");
  - los padres de un merge salían pegados.

- **Instalación dentro del proyecto (importante):** la v0.1 se instaló en `D:\ProyectosPersonales\GitOno`, la carpeta del proyecto. El instalador dejaba elegir la carpeta y le agrega el nombre de la app, así que eligiendo `D:\ProyectosPersonales` terminó ahí. El desinstalador de electron-builder borra la carpeta de instalación completa (`RMDir /r`), y actualizar ejecuta ese desinstalador. Desinstalar o instalar una versión nueva encima habría borrado el proyecto, incluido `.git`.
  - Se detectó al ver archivos de la app (`GitOno.exe`, `resources/`, DLL) sin seguimiento en `git status`.
  - Desde esta versión el instalador ya no deja elegir la carpeta: siempre usa `%LOCALAPPDATA%\Programs\GitOno`.
  - **Limpieza manual, sin usar el desinstalador:**
    - primero se hizo commit y push;
    - se borraron solo los 19 archivos sin seguimiento que coincidían uno a uno con el paquete de la app;
    - se borraron los dos accesos directos, después de verificar que apuntaban a esa instalación;
    - se borraron las dos claves de registro de GitOno 0.1.0: la de desinstalación y la de `HKCU\Software\<appId>`. Esta última guarda la carpeta de instalación, que el instalador nuevo habría usado para desinstalar la versión vieja.
  - **Quedó un archivo:** `resources/app.asar` no se pudo borrar porque lo tenía abierto la app de Claude, cuyo panel de archivos mira la carpeta (Electron deja abiertos los `.asar` que lee). Es inofensivo y se borra a mano después de reiniciar esa app.
  - **Error propio durante la limpieza:** al leer la versión de la app instalada, se extrajo su `package.json` encima del del proyecto. Se restauró al instante desde el commit y no se perdió nada.
  - **Instalador viejo:** se borró `dist/GitOno-Setup-0.1.0.exe`, el que dejaba elegir la carpeta.

### Pendiente

- Borrar `resources/` de la raíz del proyecto después de reiniciar la app de Claude.
- Instalar la v0.2.0 (`dist/GitOno-Setup-0.2.0.exe`), que ya va a `%LOCALAPPDATA%\Programs\GitOno`.
- Etapa 2 de la hoja de ruta: cambios locales (WIP, preparar y commitear).
- La búsqueda solo recorre los commits ya cargados.
- Los paneles laterales del historial tienen ancho fijo.

---

## 2026-10-20 — Sesión 1 (continuación): instalador para Windows

### Qué se hizo

- Instalador con electron-builder: `npm run dist` genera `dist/GitOno-Setup-0.1.0.exe`. Instala por usuario, deja elegir la carpeta y crea accesos directos en el escritorio y el menú Inicio.
- Ícono propio: `build/icon.svg` (fuente) y `build/icon.png` (512 × 512).
- React, React DOM y Monaco pasaron a `devDependencies`. Vite ya los incluye en `out/`, así que no hace falta que electron-builder los empaquete otra vez. Resultado: `app.asar` de 24 MB e instalador de 110 MB (la mayor parte es Electron).

### Cómo se probó

- Se ejecutó el `GitOno.exe` empaquetado (`dist/win-unpacked`) sobre un repo de ejemplo. Compara ramas y muestra el diff con resaltado de sintaxis, sin errores en la consola. Monaco y sus workers funcionan dentro del `app.asar`.
- El `.exe` lleva nombre, versión y copyright en sus propiedades.
- El instalador en sí no se ejecutó: queda para hacerlo a mano.

### Decisiones y pendientes

- **Sin firma digital:** un certificado de firma de código es pago. Por eso Windows SmartScreen muestra un aviso la primera vez.
- **Sin actualización automática:** para actualizar, se genera el instalador de nuevo y se instala encima.
- **Ícono:** el PNG se generó renderizando el SVG con Electron. Cualquier exportador de SVG a PNG con fondo transparente sirve para regenerarlo.

---

## 2026-10-20 — Sesión 1: idea y primera versión

### La idea

Un cliente Git gratuito y de uso personal, inspirado en GitKraken. La necesidad principal: **comparar archivos de dos ramas del mismo repo sin tener que clonarlo dos veces**. Tiene que funcionar con GitHub y GitLab, y quedar preparado para sumar otras plataformas.

### Decisiones

- **Un solo clon alcanza.** Git guarda todas las ramas en `.git`, así que se puede leer cualquier archivo de cualquier rama con `git cat-file` sin hacer checkout. La app compara A contra B como dos carpetas y no toca la carpeta de trabajo.
- **Dos capas:**
  - **Núcleo Git:** igual para todas las plataformas.
  - **Adaptadores por plataforma:** para lo que depende de cada API. Sumar una plataforma es escribir un adaptador.
- **Stack:** Electron + React + TypeScript, con Monaco (el editor de VS Code) como visor de diferencias y el `git` instalado en la máquina para todas las operaciones.
- **Nombre:** GitOno.

### Qué se hizo

- Proyecto base con electron-vite: proceso principal, preload y React, con TypeScript estricto.
- Núcleo Git (`src/main/git/`):
  - abrir repo;
  - listar ramas locales, remotas y tags;
  - comparar dos referencias;
  - leer archivos de cualquier rama;
  - `fetch`.
- Adaptadores (`src/main/providers/`): interfaz `GitProvider`, lectura de URLs de remoto, detección de GitHub y GitLab (incluidas instancias propias).
- Interfaz:
  - selector de ramas A y B, con un botón para intercambiarlas;
  - árbol de archivos cambiados con estados y conteo de líneas;
  - visor Monaco lado a lado o en línea, con ignorar espacios y ocultar sin cambios;
  - filtro de archivos, navegación con ↑ / ↓ y panel redimensionable;
  - tema claro u oscuro según Windows.
- Se puede abrir la app directo en un repo pasando la carpeta como argumento.
- Documentación: README, arquitectura y esta bitácora.
- El proyecto quedó en `D:\ProyectosPersonales\GitOno`, con su repositorio Git (rama `main`) y el primer commit.
- Se publicó en GitHub como repo público: https://github.com/LucasSarappa/GitOno. Antes de subirlo:
  - se revisó que no hubiera credenciales ni datos personales en los archivos;
  - se agregó la licencia MIT;
  - se sumaron los archivos `.env` al `.gitignore`, para que ninguna credencial futura se suba por error.

### Cómo se probó

- 27 tests automáticos (`npm test`), incluida una prueba contra un repo Git real creado en una carpeta temporal.
- `npm run typecheck` y `npm run build` sin errores.
- Prueba manual de la app compilada sobre un repo de ejemplo con dos ramas divergentes. Se verificó:
  - archivos nuevos, borrados, modificados, renombrados y binarios;
  - cantidad de commits de cada lado;
  - resaltado de sintaxis y textos en español en el visor;
  - vista en línea, navegación con teclado e intercambio de A y B;
  - consola sin errores, tanto en la versión compilada como en `npm run dev`.

### Problemas encontrados y cómo se resolvieron

- **Monaco 0.57 cambió las rutas de sus módulos.** Los workers ahora se importan como `monaco-editor/editor/editor.worker?worker` (antes era `monaco-editor/esm/vs/...`).
- **Subrayados rojos en el diff.** Monaco trae servicios de TypeScript, JSON y CSS que marcaban errores falsos, por ejemplo imports que no puede resolver. Como el visor es de solo lectura, se desactivaron las validaciones.
- **El panel no ocupaba toda la altura.** La grilla principal reservaba una fila para el aviso de error aunque no hubiera ninguno. Se cambió a flexbox.
- **Rutas largas en Windows.** Git no puede trabajar en carpetas cuya ruta supera los 260 caracteres. No afecta a la app, pero conviene tenerlo en cuenta para los repos de prueba.
- **TypeScript 7** ya no incluye tipos globales por defecto, así que cada `tsconfig` declara los suyos explícitamente: `node` o `vite/client`.

### Pendiente

- No se probó **Actualizar ramas** contra un servidor real (el repo de ejemplo tiene un remoto ficticio).
- Archivos con codificación distinta de UTF-8 (por ejemplo Latin-1) se muestran con caracteres raros.
- Los hosts propios de GitHub Enterprise o de GitLab sin "gitlab" en el dominio todavía no se reconocen. Falta una pantalla de configuración para registrarlos.
- Siguientes etapas: ver "Próximos pasos" en el [README](../README.md).
