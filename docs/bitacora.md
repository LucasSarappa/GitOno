# Bitácora de GitOno

Registro de lo que se hace en cada sesión: qué se construyó, qué se decidió y por qué, cómo se probó y qué quedó pendiente. Lo más nuevo va arriba.

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
