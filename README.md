# GitOno

Cliente Git de escritorio, gratuito y para uso personal, inspirado en GitKraken: historial con gráfico de ramas, detalle de cada commit y diferencias con el visor de VS Code. Suma algo que GitKraken no resuelve bien: **comparar dos ramas lado a lado sin cambiarte de rama ni clonar el repo dos veces**.

Funciona con cualquier repositorio Git (GitHub, GitLab, servidores propios) y no necesita cuenta ni conexión a internet.

## Qué hace hoy (v0.2)

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

- Botón **Actualizar ramas** (`git fetch --all --prune`) para traer las novedades del servidor.
- Detecta si el repo es de GitHub, GitLab u otro servidor.
- Tema claro u oscuro según la configuración de Windows.

**Atajos:**
- En el historial: **↑ / ↓**, **RePág / AvPág**, **Inicio / Fin** para moverte por los commits, y **Esc** para volver del diff al historial.
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

Esto genera `dist/GitOno-Setup-<versión>.exe` (por ejemplo `GitOno-Setup-0.2.0.exe`, unos 110 MB, casi todo es Electron). Ejecutalo y seguí los pasos:

- se instala solo para tu usuario, sin permisos de administrador, en `%LOCALAPPDATA%\Programs\GitOno`;
- crea accesos directos en el escritorio y en el menú Inicio.

La carpeta de instalación es fija a propósito: el desinstalador borra esa carpeta entera, así que nunca tiene que coincidir con una carpeta de trabajo.

El instalador no está firmado digitalmente (un certificado de firma de código es pago), así que Windows SmartScreen va a mostrar "Windows protegió tu PC". Tocá **Más información** y después **Ejecutar de todas formas**.

Para actualizar, volvé a correr `npm run dist` e instalá encima. Para desinstalar, andá a **Configuración → Aplicaciones**.

## Estructura

```
src/
  main/             Proceso principal (Node): acá se ejecuta Git
    git/            Núcleo Git: ramas, historial, comparación, lectura de archivos
    providers/      Adaptadores por plataforma (GitHub, GitLab, ...)
    ipc.ts          Canales entre la interfaz y el proceso principal
  preload/          Puente seguro que expone window.gitono a la interfaz
  renderer/         Interfaz (React)
    src/views/      Pestañas: Historial y Comparar ramas
    src/components/ Gráfico, lista de commits, panel de ramas, detalle, visor de diferencias
    src/lib/        Lógica de la interfaz (gráfico, etiquetas, árbol, formatos, preferencias)
  shared/           Tipos compartidos entre procesos
build/              Ícono de la app
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
