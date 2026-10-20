# GitOno

Cliente Git de escritorio, gratuito y para uso personal. La idea es parecida a GitKraken, pero centrada en lo que más falta hace en el día a día: **comparar dos ramas lado a lado sin cambiarte de rama ni clonar el repo dos veces**.

Funciona con cualquier repositorio Git (GitHub, GitLab, servidores propios), y está pensado para sumar integraciones con cada plataforma más adelante.

## Qué hace hoy (v0.1)

- Abre un repositorio que ya tengas clonado.
- Lista ramas locales, ramas remotas y tags.
- Compara la rama **A** contra la rama **B** como si fueran dos carpetas:
  - árbol de archivos con su estado: nuevo (+), borrado (−), modificado (~), renombrado (→);
  - líneas agregadas y borradas por archivo, y cuántos commits tiene cada rama que la otra no;
  - visor de diferencias de VS Code (Monaco): lado a lado o en línea, resaltado de sintaxis, opción de ignorar espacios y de ocultar las partes sin cambios.
- No toca tu carpeta de trabajo: lee las dos versiones directo de la base de datos de Git.
- Botón **Actualizar ramas** (`git fetch --all --prune`) para traer las ramas nuevas del servidor.
- Detecta si el repo es de GitHub, GitLab u otro servidor.
- Tema claro u oscuro según la configuración de Windows.

Atajos: con el foco en la lista de archivos, **↑ / ↓** pasa al archivo anterior o siguiente.

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
| `npm test` | Corre los tests (incluye pruebas contra un repo Git real temporal). |
| `npm run typecheck` | Revisa los tipos de TypeScript. |

## Estructura

```
src/
  main/             Proceso principal (Node): acá se ejecuta Git
    git/            Núcleo Git: ramas, comparación, lectura de archivos
    providers/      Adaptadores por plataforma (GitHub, GitLab, ...)
    ipc.ts          Canales entre la interfaz y el proceso principal
  preload/          Puente seguro que expone window.gitono a la interfaz
  renderer/         Interfaz (React)
    src/components/ Selector de ramas, árbol de archivos, visor de diferencias
    src/lib/        Lógica de la interfaz (árbol, preferencias, estados)
  shared/           Tipos compartidos entre procesos
docs/
  arquitectura.md   Cómo está armada la app y por qué
  bitacora.md       Registro de lo que se fue haciendo en cada sesión
```

## Documentación

- [Arquitectura](docs/arquitectura.md): procesos, capas, comandos Git usados, cómo sumar una plataforma nueva.
- [Bitácora](docs/bitacora.md): qué se hizo, qué decisiones se tomaron y qué quedó pendiente.

## Próximos pasos

1. **Más comparación:** pasar cambios de una rama a otra (un bloque, un archivo o un commit), elegir commits sueltos además de ramas, y abrir una rama en una carpeta aparte con `git worktree`.
2. **Integración con plataformas:** login con token, comparar ramas de repos remotos **sin clonarlos** (API de GitHub y GitLab), y ver Pull Requests / Merge Requests.
3. **Cliente completo:** gráfico de commits, stage y commit, push y pull, crear y cambiar ramas.
4. **Distribución:** instalador para Windows.

## Licencia

[MIT](LICENSE): podés usar, copiar y modificar el código libremente, manteniendo el aviso de autor.
