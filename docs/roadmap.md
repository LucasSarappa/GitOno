# Hoja de ruta de GitOno

El objetivo es tener todo lo que ofrece GitKraken, gratis y sin cuenta, y sumar herramientas propias. Las etapas están ordenadas para que cada una deje algo usable. Las casillas marcadas ya están hechas.

## Etapa 1: Historial ✅ (v0.2)

- [x] Gráfico de commits con carriles de colores, merges y rama actual.
- [x] Etiquetas de ramas locales, remotas y tags en cada commit.
- [x] Panel de ramas (locales, remotas por remoto, tags) con filtro y salto al commit.
- [x] Detalle del commit:
  - [x] mensaje, autor y fecha;
  - [x] SHA y padres;
  - [x] archivos y diff de cada uno.
- [x] Búsqueda por mensaje, autor o SHA.
- [x] Carga por tandas y lista virtualizada para repos grandes.
- [x] Comparar ramas como pestaña aparte.

## Etapa 2: Cambios locales ✅ (v0.3)

Lo que GitKraken muestra arriba de todo como "WIP".

- [x] Fila de cambios sin commitear en el gráfico, con la cantidad de archivos.
- [x] Panel de preparación:
  - [x] archivos sin preparar, preparados y con conflictos;
  - [x] preparar o quitar por archivo, por bloque y por línea;
  - [x] descartar cambios (los archivos nuevos van a la papelera).
- [x] Diff de cada archivo: por bloques, o lado a lado contra el índice o el último commit.
- [x] Escribir el commit (resumen y descripción) y enmendar el último (amend).
- [x] Refresco automático al detectar cambios en el disco, también los hechos desde la terminal.
- [ ] Preparar por línea en archivos nuevos, borrados o renombrados (hoy van enteros).

## Interfaz y claridad de ramas ✅ (v0.4)

- [x] Rediseño completo, "Ono, vidrio cálido": tema claro, oscuro o del sistema; efecto vidrio que se puede apagar; íconos reales. Documentado en `DESIGN.md`.
- [x] Logo de Ono, el caniche que le da nombre a la app.
- [x] Varios repos abiertos en pestañas, con atajos y repos recientes.
- [x] Fotos de los autores (GitHub y Gravatar), que se pueden desactivar.
- [x] Linaje de cada rama: de dónde sale, en qué commit nace, desde dónde se creó, commits propios y dónde se mergeó, resaltado en el gráfico.
- [x] Columna de ramas y tags a la izquierda del gráfico, unida a cada commit, como en GitKraken.
- [x] "Comparar con main" desde el linaje de una rama.
- [ ] Probar la barra de título propia en macOS y la fila de pestañas en Linux.

## Etapa 3: Operaciones ✅ (v0.5)

- [x] Checkout de ramas (doble clic), de remotas (crea la local que la sigue) y de commits. Si hay cambios que se pisarían, ofrece guardarlos en un stash.
- [x] Ramas: crear, renombrar y borrar (local y remota); elegir qué rama remota sigue; avanzar una rama hasta otra sin cambiarte de rama.
- [x] Pull (tres modos, con uno por defecto), push, fetch y publicar una rama nueva. Push forzado con `--force-with-lease` si el servidor rechaza.
- [x] Integrar cambios:
  - [x] merge (normal, `--no-ff` o `--ff-only`), rebase, cherry-pick y revert (también de commits de merge);
  - [x] reset suave, mixto y duro, con confirmación;
  - [x] aviso de operación a medio hacer, con Abortar y Continuar.
- [x] Tags: crear (livianos o anotados), borrar y publicar, también borrarlos del servidor.
- [x] Stash: guardar, aplicar, sacar (pop), ver sus cambios, cambiar el mensaje y borrar.
- [x] Menú contextual en commits, ramas, tags, la fila WIP y stashes.
- [x] Arrastrar una rama sobre otra: merge, rebase, fast-forward o comparar.
- [x] Deshacer y rehacer (Ctrl+Z / Ctrl+Y), con un aviso que ofrece deshacer lo último.
- [x] Abrir ramas y commits en GitHub/GitLab y crear el pull request o merge request.
- [ ] Ver los stashes en el gráfico, como nodos propios.
- [x] Progreso de pull, push y fetch, y fetch automático cada tanto (v0.6).
- [ ] Elegir varias ramas para borrarlas juntas.
- [ ] Fijar ramas a la izquierda del gráfico ("Pin to left").

## Interfaz flexible ✅ (v0.5)

- [x] Paneles laterales que se ensanchan arrastrando el borde y se ocultan (Ctrl+K y Ctrl+J).
- [x] Columnas del historial: ancho, orden y cuáles se ven (clic derecho en el encabezado).
- [x] Ocultar ramas del gráfico o mostrar solo algunas.
- [x] Zoom de la interfaz (Ctrl + y Ctrl −) (v0.6).
- [ ] Preferencias por repo (hoy las columnas y paneles valen para todos).

## Temas, disposición y menos carga visual ✅ (v0.6)

- [x] Ocho temas (cuatro claros y cuatro oscuros) y todos los colores personalizables, con aviso de contraste y para copiar y pegar un tema.
- [x] Los tres cuadros se acomodan arrastrándolos a cualquier borde, con seis disposiciones listas.
- [x] Menos carga visual, como GitKraken: paneles pegados, tres columnas por defecto, fotos en los nodos, etiquetas con tinte, barra con el nombre debajo del ícono. Diagnóstico en `docs/evaluacion-ux.md`.
- [x] Rama fantasma al pasar por un commit y lista desplegable de etiquetas "+N".
- [x] Paleta de comandos (Ctrl+P).
- [x] Buscar en el código de los commits (`git log -S`).
- [x] Abrir el repo en el explorador, una terminal o VS Code.
- [ ] Probar los temas y la disposición en macOS y Linux.

## Etapa 4: Herramientas avanzadas

- [ ] Resolución de conflictos en tres paneles (base, nuestro y de ellos) con resultado editable.
- [ ] Rebase interactivo visual: reordenar, unir (squash), editar y descartar commits.
- [ ] Historial de un archivo y blame (quién cambió cada línea).
- [ ] Submódulos, worktrees y Git LFS.
- [x] Paleta de comandos (Ctrl+P) (v0.6).
- [ ] Atajos configurables.

## Etapa 5: Plataformas (GitHub, GitLab y otras)

- [ ] Cuentas con token personal y, más adelante, login con navegador.
- [ ] Clonar eligiendo de la lista de tus repos.
- [ ] Pull Requests / Merge Requests: ver, crear, comentar y aprobar.
- [ ] Estado de CI de cada commit y rama.
- [ ] Comparar ramas de un repo remoto sin clonarlo.
- [ ] Issues vinculados a ramas y commits.

## Extras propios

Ideas que no están en GitKraken (o que ahí son pagas) y que pueden ser útiles:

- **Comparar con más libertad:** cualquier par de commits (Ctrl+clic en dos commits del historial), o una rama contra la carpeta de trabajo.
- **Comparar ramas entre forks.**
- **Diff inteligente para JSON y YAML:** ignora el orden de las claves y muestra solo los valores que cambiaron.
- **Detector de secretos antes de commitear:** avisa si un cambio incluye tokens, contraseñas o claves privadas.
- **Ayuda con los mensajes de commit:** plantilla y validación de Conventional Commits (`feat:`, `fix:`, …).
- **Estadísticas del repo:** commits por autor, actividad por semana y archivos que más cambian.
- **Exportar un diff** como `.patch` o como página HTML para compartir.
- **Todo gratis y sin cuenta:** sin límites para repos privados y sin enviar datos a ningún servidor.
