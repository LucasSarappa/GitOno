# GitOno

Cliente Git de escritorio (Electron + React + TypeScript). Ver `README.md` y `docs/arquitectura.md`.

## Convenciones

- Todo en español: interfaz, comentarios y documentación.
- Al terminar cada sesión de trabajo, agregar una entrada arriba de todo en `docs/bitacora.md`: qué se hizo, decisiones y por qué, cómo se probó, problemas y pendientes. Si cambia la arquitectura, actualizar `docs/arquitectura.md`; si cambia lo que hace la app, actualizar el README.
- `src/main/git/` y `src/main/providers/` no importan Electron, para poder testearlos con Node.
- A Git se le pasan nombres de referencia completos (`refs/heads/...`) y se valida cada uno con `assertSafeRef`.
- Las operaciones que cambian el repo van en `src/main/git/ops.ts`, con su test contra un repo real en `ops.test.ts`. Desde la interfaz se llaman en `views/useRepoActions.tsx`, que arma los menús, pide confirmación y registra cómo deshacerlas.
- Nunca ejecutar un `Uninstall GitOno.exe` que esté dentro del proyecto: el desinstalador borra su carpeta entera (ver la bitácora del 24/10/2026).

## Diseño

- El sistema visual está en `DESIGN.md` (tokens, componentes y reglas) y el contexto del producto en `PRODUCT.md`. Los cambios de interfaz se hacen con la skill Impeccable, que lee los dos y el brief de `.impeccable/surfaces/app.md`.
- Cada pantalla se prueba en claro, en oscuro y con el vidrio apagado.
- El logo se regenera con `node build/logo/ono.mjs`. Después hay que copiar los SVG a `src/renderer/src/assets/` y `build/icon.svg`, y volver a renderizar `build/icon.png`.
- Para probar la app sin tocar la configuración del usuario, usar una carpeta de datos aparte (`--user-data-dir`).

## Comandos

- `npm run dev`: app en modo desarrollo (`npx electron-vite dev -- <carpeta>` abre directo un repo).
- `npm test`, `npm run typecheck` y `npm run build` tienen que pasar antes de dar algo por terminado.
- `npm run dist`: instalador de Windows en `dist/` (configuración en `electron-builder.yml`).
- Las dependencias que Vite empaqueta en `out/` (React, Monaco) van en `devDependencies`, para que electron-builder no las copie de nuevo dentro del instalador.
