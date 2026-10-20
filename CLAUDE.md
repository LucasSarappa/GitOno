# GitOno

Cliente Git de escritorio (Electron + React + TypeScript). Ver `README.md` y `docs/arquitectura.md`.

## Convenciones

- Todo en español: interfaz, comentarios y documentación.
- Al terminar cada sesión de trabajo, agregar una entrada arriba de todo en `docs/bitacora.md`: qué se hizo, decisiones y por qué, cómo se probó, problemas y pendientes. Si cambia la arquitectura, actualizar `docs/arquitectura.md`; si cambia lo que hace la app, actualizar el README.
- `src/main/git/` y `src/main/providers/` no importan Electron, para poder testearlos con Node.
- A Git se le pasan nombres de referencia completos (`refs/heads/...`) y se valida cada uno con `assertSafeRef`.

## Comandos

- `npm run dev`: app en modo desarrollo (`npx electron-vite dev -- <carpeta>` abre directo un repo).
- `npm test`, `npm run typecheck` y `npm run build` tienen que pasar antes de dar algo por terminado.
- `npm run dist`: instalador de Windows en `dist/` (configuración en `electron-builder.yml`).
- Las dependencias que Vite empaqueta en `out/` (React, Monaco) van en `devDependencies`, para que electron-builder no las copie de nuevo dentro del instalador.
