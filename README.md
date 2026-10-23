<p align="center"><img src="build/logo/ono.svg" width="128" alt="Ono, el caniche toy que le da nombre a GitOno"></p>

# GitOno

Cliente Git de escritorio, gratuito y para uso personal, inspirado en GitKraken: varios repos en pestañas, historial con gráfico de ramas, preparar y commitear cambios (también por bloque o por línea) y diferencias con el visor de VS Code. Suma dos cosas que GitKraken no resuelve bien:
- **Comparar dos ramas lado a lado** sin cambiarte de rama ni clonar el repo dos veces.
- **El linaje de cada rama:** de dónde sale, en qué commit nace, desde dónde se creó y dónde y con qué commit se mergeó.

Funciona con cualquier repositorio Git (GitHub, GitLab, servidores propios) y no necesita cuenta. El nombre viene de **Ono**, el caniche toy del autor: es el logo de la app.

## Qué hace hoy (v0.4)

### Interfaz

- **Varios repos a la vez, en pestañas**, como en GitKraken:
  - **+** abre una pestaña nueva; **Ctrl+T**, **Ctrl+W** y **Ctrl+Tab** la abren, la cierran y pasan a la siguiente; **Ctrl+O** abre un repo;
  - el clic con la rueda cierra una pestaña;
  - las pestañas se recuerdan al cerrar la app;
  - la pestaña nueva muestra los repos recientes.
- **Tema claro, oscuro o el del sistema**, y **efecto vidrio**: paneles translúcidos con desenfoque. Se apaga si preferís paneles sólidos, y se apaga solo si el sistema pide menos transparencia. Todo está en el botón de **Apariencia** (paleta).
- **Fotos de los autores**, como en GitKraken:
  - en repos de GitHub, con la API pública;
  - para los emails privados de GitHub, directo desde el email;
  - para el resto, con Gravatar;
  - sin foto, se muestran las iniciales.

  Se pueden desactivar en Apariencia, y entonces la app no hace ningún pedido a internet.
- Diseño propio, "Ono, vidrio cálido": paleta crema, damasco y caramelo (cacao en oscuro). Está documentado en [DESIGN.md](DESIGN.md).

### Linaje de las ramas

- Al elegir una rama (en el panel izquierdo, en su etiqueta del gráfico o en "En ramas" del detalle de un commit), el gráfico **resalta sus commits y atenúa el resto**.
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
- **Panel de ramas** a la izquierda: locales, remotas agrupadas por remoto y tags, con filtro. Un clic lleva al commit de esa rama.
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

- Botón **Actualizar** (`git fetch --all --prune`) para traer las novedades del servidor.
- Detecta si el repo es de GitHub, GitLab u otro servidor.

**Atajos:**
- Pestañas: **Ctrl+T**, **Ctrl+W**, **Ctrl+Tab** / **Ctrl+Shift+Tab** y **Ctrl+O**.
- En el historial: **↑ / ↓**, **RePág / AvPág**, **Inicio / Fin** para moverte por los commits, y **Esc** para volver del diff o dejar de resaltar una rama.
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

Esto genera `dist/GitOno-Setup-<versión>.exe` (por ejemplo `GitOno-Setup-0.4.0.exe`, unos 110 MB, casi todo es Electron). Ejecutalo y seguí los pasos:

- se instala solo para tu usuario, sin permisos de administrador, en `%LOCALAPPDATA%\Programs\GitOno`;
- crea accesos directos en el escritorio y en el menú Inicio.

La carpeta de instalación es fija a propósito: el desinstalador borra esa carpeta entera, así que nunca tiene que coincidir con una carpeta de trabajo.

El instalador no está firmado digitalmente (un certificado de firma de código es pago), así que Windows SmartScreen va a mostrar "Windows protegió tu PC". Tocá **Más información** y después **Ejecutar de todas formas**.

Para actualizar, volvé a correr `npm run dist` e instalá encima. Para desinstalar, andá a **Configuración → Aplicaciones**.

## Estructura

```
src/
  main/             Proceso principal (Node): acá se ejecuta Git
    git/            Núcleo Git: ramas, linaje, historial, comparación, cambios locales, vigilancia del disco
    providers/      Adaptadores por plataforma (GitHub, GitLab, ...)
    avatars.ts      Fotos de los autores (GitHub, Gravatar) con caché
    ipc.ts          Canales entre la interfaz y el proceso principal
  preload/          Puente seguro que expone window.gitono a la interfaz
  renderer/         Interfaz (React)
    src/views/      Espacio de cada repo (RepoWorkspace), Historial y Comparar ramas
    src/assets/     Logo de Ono
    src/components/ Gráfico, lista de commits, panel de ramas, detalle, visor de diferencias
    src/lib/        Lógica de la interfaz (gráfico, etiquetas, árbol, formatos, preferencias)
  shared/           Tipos compartidos y armado de parches (patch.ts)
build/              Ícono de la app y generador del logo (build/logo/ono.mjs)
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
