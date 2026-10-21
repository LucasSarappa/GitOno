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

## Etapa 2: Cambios locales

Lo que GitKraken muestra arriba de todo como "WIP".

- [ ] Fila de cambios sin commitear en el gráfico, con la cantidad de archivos.
- [ ] Panel de preparación:
  - [ ] archivos sin preparar y preparados;
  - [ ] preparar o quitar por archivo, por bloque y por línea;
  - [ ] descartar cambios.
- [ ] Diff de la carpeta de trabajo contra el último commit.
- [ ] Escribir el commit (resumen y descripción) y enmendar el último (amend).
- [ ] Refresco automático al detectar cambios en el disco.

## Etapa 3: Operaciones

- [ ] Checkout de ramas (doble clic) y de commits.
- [ ] Ramas: crear, renombrar y borrar (local y remota).
- [ ] Pull, push y fetch con progreso; publicar una rama nueva.
- [ ] Integrar cambios:
  - [ ] merge, rebase, cherry-pick y revert;
  - [ ] reset suave, mixto y duro, con confirmación.
- [ ] Tags: crear, borrar y publicar.
- [ ] Stash: guardar, aplicar, sacar (pop) y borrar; verlos en el gráfico.
- [ ] Menú contextual en commits y ramas con todas estas acciones.
- [ ] Arrastrar una rama sobre otra para hacer merge o rebase.
- [ ] Deshacer y rehacer la última operación (usando el reflog).

## Etapa 4: Herramientas avanzadas

- [ ] Resolución de conflictos en tres paneles (base, nuestro y de ellos) con resultado editable.
- [ ] Rebase interactivo visual: reordenar, unir (squash), editar y descartar commits.
- [ ] Historial de un archivo y blame (quién cambió cada línea).
- [ ] Submódulos, worktrees y Git LFS.
- [ ] Varias pestañas con distintos repos abiertos a la vez.
- [ ] Paleta de comandos (Ctrl+P) y atajos configurables.

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
