<p align="center"><img src="build/logo/ono.svg" width="128" alt="Ono, el caniche toy que le da nombre a GitOno"></p>

# GitOno

Cliente Git de escritorio, gratuito y para uso personal, inspirado en GitKraken: varios repos en pestañas, historial con gráfico de ramas, operaciones con clic derecho (checkout, merge, rebase, cherry-pick, reset, tags, stash, pull y push) con Deshacer, preparar y commitear cambios (también por bloque o por línea) y diferencias con el visor de VS Code. Suma dos cosas que GitKraken no resuelve bien:
- **Comparar dos ramas lado a lado** sin cambiarte de rama ni clonar el repo dos veces.
- **El linaje de cada rama:** de dónde sale, en qué commit nace, desde dónde se creó y dónde y con qué commit se mergeó.

Funciona con cualquier repositorio Git (GitHub, GitLab, servidores propios) y no necesita cuenta. El nombre viene de **Ono**, el caniche toy del autor: es el logo de la app.

## Qué hace hoy (v0.6)

### Como GitKraken, con menos carga visual

- **Paneles pegados** como en GitKraken, separados por una línea fina. El vidrio esmerilado queda como opción en Apariencia.
- **Columnas por defecto:** Rama / tag, Gráfico y Mensaje. Autor, Fecha y SHA se suman con clic derecho en el encabezado.
- **Fotos de los autores en los nodos del gráfico.**
- **Etiquetas de rama con un tinte suave** del color de su carril; la rama actual es la única llena.
- **Barra de herramientas** con el ícono arriba y el nombre abajo.
- **Fila WIP con íconos y cantidades:** modificados, nuevos, borrados y en conflicto.
- **Rama fantasma:** al pasar el mouse por un commit sin etiquetas (o al elegirlo), aparece tenue la rama más cercana que lo contiene. Doble clic hace checkout.
- **Lista desplegable:** si un commit tiene varias ramas ("+2"), al apoyar el mouse se despliegan todas, cada una con su menú.

### Temas y colores

- **Ocho temas:**
  - claros: Crema, Papel, Niebla y Solar;
  - oscuros: Cacao, Abismo (el más parecido a GitKraken), Grafito y Alto contraste.

  Se elige uno para el modo claro y otro para el oscuro, y la app sigue al sistema o queda fija.
- **Cualquier color se puede cambiar:** fondo, paneles, textos, acento, estados de archivo y los ocho carriles del gráfico. Los cambios se ven en vivo y cada color vuelve al original con un clic. Si un cambio deja texto difícil de leer, avisa con la relación de contraste.
- **Compartir un tema:** "Copiar el tema" lo copia como texto y "Pegar" lo carga.
- Los ocho temas cumplen el contraste mínimo de WCAG AA; lo verifica un test.

### Paneles acomodables

- **Arrastrar cada cuadro a cualquier borde:**
  - el panel de ramas y el de detalle se arrastran desde su barra de título;
  - el gráfico, desde el encabezado de sus columnas.

  Pueden ir a la izquierda, a la derecha, arriba o abajo, al lado del gráfico o de todo. Mientras se arrastra, un recuadro muestra dónde va a quedar.
- **Menú Disposición** (al lado de la búsqueda), con seis disposiciones listas: clásica, espejada, detalle abajo, ramas arriba, gráfico a la derecha y solo el gráfico.
- **Teclado:** el botón ⋯ de cada panel lo mueve u oculta sin arrastrar.

### Más herramientas

- **Paleta de comandos (Ctrl+P):** todo lo que se puede hacer, buscando con unas letras ("chk pagos" → checkout de feature/pagos). Incluye operaciones, checkout y linaje de cada rama, temas y zoom.
- **Buscar en el código:** el botón `<>` de la búsqueda encuentra los commits que agregan o quitan un texto (`git log -S`), no solo por mensaje.
- **Progreso de pull, push y fetch** en la barra ("Recibiendo objetos 45 %").
- **Fetch automático** cada 5, 15 o 30 minutos, desde el menú de Pull. Viene apagado.
- **Abrir el repo** en el explorador, en una terminal o en VS Code: clic en el nombre del repo.
- **Zoom** de toda la interfaz (Ctrl+= / Ctrl+− / Ctrl+0, o en Apariencia).
- **Lista de atajos**, desde la paleta de comandos.
- **Panel de detalle liviano:**
  - el autor y la fecha en una línea;
  - SHA, padres y ramas en chips ("en 3 ramas" se despliega con un clic);
  - la descripción larga, recortada con "Ver más";
  - los archivos, en árbol o en lista.

  Con el ⋯ del panel se elige qué mostrar.

### Operaciones (clic derecho, como en GitKraken)

- **Clic derecho en una rama** (en el gráfico o en el panel izquierdo):
  - checkout (de una remota crea la rama local que la sigue);
  - mergear en la rama actual (normal, siempre con commit de merge o solo si es avance rápido) y rebasear la actual encima;
  - avanzar una rama hasta su remota sin cambiarte de rama;
  - pull, push o publicarla en el servidor, y elegir qué rama remota sigue;
  - crear una rama o un tag ahí, comparar con la rama actual y ver de dónde sale;
  - ocultarla del gráfico o mostrar solo esa;
  - abrirla en GitHub o GitLab y crear el pull request o merge request;
  - copiar el nombre o el SHA, renombrarla y borrarla (también en el servidor).
- **Clic derecho en un commit:** checkout (HEAD desacoplado), crear rama o tag, cherry-pick, revertir, **reset suave, mixto o duro**, rebasear la rama actual encima, guardar como `.patch`, abrir en GitHub/GitLab y copiar SHA, enlace o mensaje.
- **Clic derecho en la fila WIP:** guardar los cambios en un stash, crear una rama con esos cambios o descartar todo.
- **Tags:** crear livianos o anotados (y subirlos), subir, borrar local y en el servidor.
- **Stash:** guardar (con mensaje, incluidos los archivos nuevos), aplicar, sacar (pop), ver sus cambios, cambiar el mensaje y borrar. Están en el panel izquierdo.
- **Arrastrar una rama sobre otra:** mergear, rebasear, avanzar (fast-forward) o comparar.
- **Doble clic en una rama:** checkout. Si tenés cambios que el checkout pisaría, ofrece guardarlos en un stash y cambiar igual.
- **Barra de herramientas:** Deshacer, Rehacer, **Pull** (con fetch y tres modos: avance rápido si se puede, solo avance rápido o rebase; el modo por defecto se elige), **Push** (con la cantidad de commits para subir y bajar), Rama, Stash y Pop.
- **Deshacer y Rehacer (Ctrl+Z / Ctrl+Y):** checkout, crear, renombrar y borrar ramas, merges, rebases, cherry-picks, reverts, resets, commits, tags, stashes y descartar cambios. Un aviso abajo ofrece deshacer lo último.
- **Conflictos:** si un merge, rebase, cherry-pick, revert o stash queda con conflictos, un aviso arriba lo dice, muestra los archivos y tiene **Abortar** y **Continuar**. Los conflictos se resuelven en tu editor y se marcan como resueltos preparándolos.
- **Push rechazado:** si el servidor tiene commits que no tenés, ofrece forzar el push con `--force-with-lease`, que no pisa commits que no viste.
- Las operaciones peligrosas (reset duro, borrar ramas, tags o stashes) piden confirmación en un diálogo, y los errores se muestran ahí mismo.

### Todo ajustable

- **Paneles:** el de ramas y el de detalle se ensanchan arrastrando su borde (doble clic vuelve al ancho original) y se ocultan con los botones de la barra del historial, o con **Ctrl+K** y **Ctrl+J**.
- **Columnas del historial:** se ensanchan arrastrando su borde, se reordenan arrastrando el título y con **clic derecho en el encabezado** se elige cuáles ver (Rama / tag, Gráfico, Autor, Fecha, SHA). Si la ventana es angosta, se ocultan solas para que el mensaje no quede apretado.
- **Ramas ocultas:** el ojo de cada rama del panel la oculta del gráfico; también se puede mostrar solo una o varias.
- Todo se recuerda al cerrar la app.

### Interfaz

- **Varios repos a la vez, en pestañas**, como en GitKraken:
  - **+** abre una pestaña nueva; **Ctrl+T**, **Ctrl+W** y **Ctrl+Tab** la abren, la cierran y pasan a la siguiente; **Ctrl+O** abre un repo;
  - el clic con la rueda cierra una pestaña;
  - las pestañas se recuerdan al cerrar la app;
  - la pestaña nueva muestra los repos recientes.
- **Modo claro, oscuro o el del sistema**, ocho temas y **efecto vidrio** opcional (paneles translúcidos que flotan con desenfoque; se apaga solo si el sistema pide menos transparencia). Todo está en el botón de **Apariencia** (paleta).
- **Fotos de los autores**, como en GitKraken:
  - en repos de GitHub, con la API pública;
  - para los emails privados de GitHub, directo desde el email;
  - para el resto, con Gravatar;
  - sin foto, se muestran las iniciales.

  Se pueden desactivar en Apariencia, y entonces la app no hace ningún pedido a internet.
- Diseño propio: los temas de fábrica, Crema y Cacao, salen del pelaje de Ono. Está documentado en [DESIGN.md](DESIGN.md); el diagnóstico de la v0.6 para bajar la carga visual, en [docs/evaluacion-ux.md](docs/evaluacion-ux.md).

### Linaje de las ramas

- Un clic en una rama solo lleva a su commit, como en GitKraken. El linaje se pide a propósito: con la **mira** que aparece al pasar el mouse por una rama del panel, o con clic derecho → **Ver de dónde sale**. Entonces el gráfico **resalta sus commits y atenúa el resto**, y el linaje se muestra arriba del panel de detalle, sin tapar el gráfico (si el detalle está oculto, va arriba del gráfico).
- El gráfico marca **"nace acá"** en el commit donde salió y **"mergeada en main"** en el merge.
- Una tarjeta resume el linaje:
  - de qué rama sale y en qué commit;
  - desde dónde se creó (según el reflog);
  - cuántos commits propios tiene y cuántos le faltan de la principal;
  - si se mergeó: con commit de merge (con enlace) o por avance rápido;
  - un botón para **compararla con la principal**.
- Las etiquetas de ramas y tags están en una **columna propia a la izquierda del gráfico**, unidas a su commit con una línea del color de la rama. La rama actual lleva ✓. Una rama local y su remota en el mismo commit se ven juntas, con los íconos de computadora y nube.
- El detalle de un merge dice **qué rama se mergeó en cuál**, leyendo el mensaje. Entiende los formatos de Git, GitHub y GitLab.

### Cambios locales y commits

- **Fila "// WIP"** arriba del gráfico con los cambios sin commitear, unida con línea punteada al commit actual.
- **Panel de preparación** al elegirla:
  - archivos sin preparar, preparados y con conflictos;
  - preparar, quitar o descartar un archivo (o todos) con un clic. Los archivos nuevos que se descartan van a la papelera de reciclaje.
- **Por bloque y por línea:** al abrir un archivo modificado se ven sus cambios por bloques.
  - Cada bloque se puede preparar, quitar o descartar entero.
  - Con clic (o Shift+clic para un rango) se eligen líneas sueltas, y los botones actúan solo sobre ellas.
  - También se puede ver el archivo lado a lado contra el índice o contra el último commit.
- **Commit** con resumen (con contador de 72 caracteres) y descripción, con **Ctrl+Enter**. Opción de **enmendar el último commit**: trae su mensaje para editarlo.
- **Se actualiza sola:** detecta cambios en el disco (archivos editados, commits o ramas hechos desde la terminal) y refresca en menos de medio segundo.
- Antes de descartar siempre pide confirmación.

### Historial

- **Gráfico de commits** de todas las ramas, remotas y tags, con carriles de colores, merges y la rama actual marcada.
- **Etiquetas en cada commit:**
  - ramas locales y remotas (si una rama y su remota apuntan al mismo commit, se muestran juntas);
  - tags;
  - HEAD.
- **Panel de ramas** a la izquierda: locales (con ↑ commits para subir y ↓ para bajar), remotas agrupadas por remoto, tags y stashes, con filtro. Un clic lleva al commit de esa rama.
- **Detalle del commit** a la derecha:
  - mensaje completo, autor y fecha;
  - SHA (con botón para copiarlo);
  - padres, con un clic para ir a cada uno;
  - archivos cambiados. Al hacer clic en uno, se ve su diff respecto del commit anterior.
- **Búsqueda** por mensaje, autor o SHA, con **Enter / Shift+Enter** para ir a la coincidencia siguiente o anterior.
- **Repos grandes:** la lista solo dibuja lo visible y carga el historial por tandas de 1.000 commits. Probado con 20.000 commits.

### Comparar ramas

- Compara la rama **A** contra la rama **B** como si fueran dos carpetas:
  - árbol de archivos con su estado: nuevo (+), borrado (−), modificado (~), renombrado (→);
  - líneas agregadas y borradas por archivo, y cuántos commits tiene cada rama que la otra no;
  - visor de diferencias lado a lado o en línea, con opción de ignorar espacios y de ocultar las partes sin cambios.
- No toca tu carpeta de trabajo: lee las dos versiones directo de la base de datos de Git.

### General

- **Fetch** (`git fetch --all --prune`) desde el menú de Pull, para traer las novedades del servidor.
- Detecta si el repo es de GitHub, GitLab u otro servidor.

**Atajos:**
- Pestañas: **Ctrl+T**, **Ctrl+W**, **Ctrl+Tab** / **Ctrl+Shift+Tab** y **Ctrl+O**.
- **Ctrl+Z** / **Ctrl+Y** (o **Ctrl+Shift+Z**): deshacer y rehacer la última operación.
- **Ctrl+K** / **Ctrl+J**: mostrar u ocultar el panel de ramas y el de detalle.
- **Ctrl+P**: paleta de comandos. **Ctrl+F**: buscar commits.
- **Ctrl+=** / **Ctrl+−** / **Ctrl+0**: agrandar, achicar y volver a 100 %.
- En el historial: **↑ / ↓**, **RePág / AvPág**, **Inicio / Fin** para moverte por los commits, **Esc** para volver del diff o dejar de resaltar una rama, y la tecla **Menú** (o **Shift+F10**) para abrir el menú del commit elegido.
- En la caja de commit: **Ctrl+Enter** para hacer el commit.
- En "Comparar ramas": **↑ / ↓** para pasar de un archivo a otro.

## Requisitos

- [Node.js](https://nodejs.org) 22.12 o superior.
- [Git](https://git-scm.com) instalado y disponible en el PATH.

## Cómo correrlo

```bash
npm install
npm run dev
```

Para abrir la app directamente en un repo:

```bash
npx electron-vite dev -- "C:\ruta\a\tu\repo"
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Abre la app en modo desarrollo; la interfaz se recarga sola al guardar cambios. |
| `npm run build` | Compila la app en `out/`. |
| `npm start` | Abre la versión compilada. |
| `npm test` | Corre los tests (incluye pruebas contra repos Git reales temporales). |
| `npm run typecheck` | Revisa los tipos de TypeScript. |
| `npm run dist` | Genera el instalador para Windows en `dist/`. |

## Instalarlo en Windows

```bash
npm run dist
```

Esto genera `dist/GitOno-Setup-<versión>.exe` (por ejemplo `GitOno-Setup-0.6.0.exe`, unos 110 MB, casi todo es Electron). Ejecutalo y seguí los pasos:

- "Solo para mí" la instala sin permisos de administrador en `%LOCALAPPDATA%\Programs\GitOno`; "Para todos los usuarios", en `C:\Program Files\GitOno`;
- crea accesos directos en el escritorio y en el menú Inicio.

La carpeta de instalación es fija a propósito: el desinstalador borra esa carpeta entera, así que nunca tiene que coincidir con una carpeta de trabajo. Por las dudas, el desinstalador se niega a borrar una carpeta que tenga `.git` o `package.json`.

El instalador no está firmado digitalmente (un certificado de firma de código es pago), así que Windows SmartScreen va a mostrar "Windows protegió tu PC". Tocá **Más información** y después **Ejecutar de todas formas**.

Para actualizar, volvé a correr `npm run dist` e instalá encima. Para desinstalar, andá a **Configuración → Aplicaciones**.

## Estructura

```
src/
  main/             Proceso principal (Node): acá se ejecuta Git
    git/            Núcleo Git: ramas, linaje, historial, comparación, cambios locales, operaciones, vigilancia del disco
    providers/      Adaptadores por plataforma (GitHub, GitLab, ...)
    avatars.ts      Fotos de los autores (GitHub, Gravatar) con caché
    open.ts         Abrir el repo en el explorador, una terminal o VS Code
    ipc.ts          Canales entre la interfaz y el proceso principal
  preload/          Puente seguro que expone window.gitono a la interfaz
  renderer/         Interfaz (React)
    src/views/      Espacio de cada repo (RepoWorkspace), Historial, Comparar ramas y las operaciones (useRepoActions)
    src/assets/     Logo de Ono
    src/components/ Gráfico, lista de commits, panel de ramas, detalle, visor de diferencias, menú contextual, diálogos, paleta de comandos, editor de colores
    src/lib/        Lógica de la interfaz (gráfico, etiquetas, rama fantasma, columnas, disposición, temas, búsqueda difusa, deshacer, enlaces, árbol, formatos, preferencias)
  shared/           Tipos compartidos y armado de parches (patch.ts)
build/              Ícono de la app, generador del logo (build/logo/ono.mjs) y agregados del instalador (installer.nsh)
PRODUCT.md          Qué es el producto y para quién (contexto para el diseño)
DESIGN.md           Sistema de diseño: colores, tipografía, componentes y reglas
docs/
  arquitectura.md   Cómo está armada la app y por qué
  roadmap.md        Hoja de ruta: lo que falta para igualar a GitKraken y extras propios
  bitacora.md       Registro de lo que se fue haciendo en cada sesión
```

## Documentación

- [Arquitectura](docs/arquitectura.md): procesos, capas, comandos Git usados, cómo se dibuja el gráfico, cómo sumar una plataforma nueva.
- [Hoja de ruta](docs/roadmap.md): próximas etapas y extras propuestos.
- [Bitácora](docs/bitacora.md): qué se hizo, qué decisiones se tomaron y qué quedó pendiente.

## Licencia

[MIT](LICENSE): podés usar, copiar y modificar el código libremente, manteniendo el aviso de autor.
