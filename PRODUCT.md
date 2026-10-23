# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(App de escritorio hecha con Electron y React: interfaz web empaquetada como aplicación nativa.)

## Users

Desarrolladores que trabajan a diario con Git y quieren un cliente visual como GitKraken sin pagar su suscripción (USD 36 al año). El primer usuario es el autor (Lucas), pero el repositorio es público y la app tiene que poder usarla cualquier dev que la baje, sin ayuda y sin asumir la configuración del autor.

Trabajo típico: revisar el historial de varias ramas, entender de dónde sale cada rama y dónde se mergeó, comparar dos ramas, preparar cambios (también por bloque o por línea) y commitear, a veces con varios repos abiertos a la vez.

## Product Purpose

Un clon gratuito de GitKraken, sin cuenta y sin conexión obligatoria, con las mismas funciones y mejoras propias. Éxito: reemplazar GitKraken en el uso diario sin extrañar nada.

## Positioning

- Gratis y open source (MIT), sin cuenta ni límites para repos privados.
- Compara dos ramas (o tags) lado a lado, como dos carpetas, sin cambiar de rama ni clonar dos veces.
- Deja todavía más claro que GitKraken el origen de cada rama: dónde nace, de qué rama sale y dónde y con qué se mergeó.

## Operating Context

- Sesiones largas frente a la app, a la par del editor y la terminal. La app se refresca sola ante cambios hechos desde afuera.
- Repos de cualquier tamaño (probado con 20.800 commits) alojados en GitHub, GitLab u otros servidores.
- Funciones actuales (v0.3): historial con gráfico de carriles, panel de ramas y tags, detalle de commits con diff (Monaco), búsqueda, comparar ramas, cambios locales (WIP) con preparar/quitar/descartar por archivo, bloque o línea, commit y enmendar.

## Capabilities and Constraints

- Tiene que verse y funcionar bien en **Windows, macOS y Linux**: nada que dependa de materiales visuales de un solo sistema.
- Electron 44 + React 19 + TypeScript. Monaco como visor de diferencias. Toda la interfaz y la documentación en español rioplatense.
- Seguridad: la interfaz no tiene acceso a Node (contextIsolation y sandbox), CSP estricta y Git se ejecuta solo desde el proceso principal.
- Pedidos de red: hoy solo `git fetch`. Mostrar avatares de GitHub es un pedido explícito del usuario y agrega pedidos a servidores de imágenes.
- Hoja de ruta en `docs/roadmap.md`: operaciones (checkout, ramas, pull/push, merge, rebase, stash), conflictos, rebase interactivo, integración con GitHub y GitLab.

## Brand Commitments

- Nombre: **GitOno**, por **Ono**, el caniche toy del autor (color crema/damasco, pelo con rulos, orejas caídas, ojos marrón oscuro y nariz marrón rosada). Fotos de referencia guardadas por el autor en la sesión de diseño.
- Logo: la cara de Ono como caricatura animada, lo más parecida posible a las fotos.
- Pedidos explícitos del autor sobre la interfaz: profesional, limpia y minimalista; tema claro y oscuro elegibles; estética de vidrio (tipo Liquid Glass o la mejor alternativa); organización y claridad al estilo GitKraken (gráfico de ramas, pestañas por repo, avatares de los autores).

## Evidence on Hand

- Repo público: https://github.com/LucasSarappa/GitOno
- Documentación: `README.md`, `docs/arquitectura.md`, `docs/roadmap.md`, `docs/bitacora.md`.
- No hay testimonios, usuarios externos ni métricas: no inventarlos.

## Product Principles

1. **Igual de claro que GitKraken o más:** quien viene de GitKraken encuentra todo donde lo espera.
2. **La historia de cada rama tiene que leerse sin esfuerzo:** origen, recorrido y merge, a simple vista.
3. **Nunca perder trabajo:** confirmación antes de lo irreversible, y que la app no toque lo que no le corresponde.
4. **Gratis y local por defecto:** sin cuenta, sin telemetría. Cualquier pedido de red es explícito y se puede desactivar.
5. **Rápido con repos grandes.**
