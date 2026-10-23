# Superficie: app de escritorio (shell completo)

Modo: **Operate**. El usuario viene a trabajar con sus repos: leer historial, entender ramas, comparar, preparar y commitear.

Audiencia y tarea: devs que reemplazan a GitKraken. Sesiones largas, varios repos abiertos, a la par del editor y la terminal.

Restricciones: Windows, macOS y Linux (vidrio solo con CSS, nada de materiales nativos de un sistema); claro y oscuro elegibles; español; repos grandes (20.000+ commits); seguridad de Electron sin cambios (sandbox, CSP).

Decisiones abiertas: ninguna sobre la dirección. Las operaciones de la etapa 3 (pull, push, merge…) no tienen todavía botones: no se muestran controles que no funcionan.

## Direction contract

THESIS: GitOno es GitKraken con su organización intacta (pestañas de repos en la barra de título, ramas a la izquierda, gráfico al centro, detalle a la derecha) y la historia de cada rama como protagonista. Rechaza el azul marino con neón de la categoría y las barras grises de herramienta genérica.

OWN-WORLD: el pelaje de Ono como paleta. Neutros crema y damasco cálidos, acento caramelo para la selección y la acción principal, cacao/espresso en oscuro. Paneles de vidrio esmerilado (desenfoque, borde de 1 px con brillo superior) flotando con aire sobre un fondo cálido y suave. Letra del sistema, monoespaciada para SHA y código, íconos de trazo fino, radios de 10 px. Colores de carril propios, saturados pero amables en los dos temas.

STORY: el usuario abre uno o varios repos en pestañas, entiende de un vistazo qué ramas hay y cómo se cruzan, elige una y ve de dónde nace y dónde se mergeó, y prepara y commitea sin salir de la app.

FIRST VIEWPORT: barra de título con el logo de Ono y las pestañas de repos (más "+"); barra de herramientas con rama actual, Comparar, Actualizar y apariencia; panel izquierdo de vidrio con ramas locales, remotas y tags; centro con columnas Ramas/tags · Gráfico · Mensaje · Autor (avatar) · Fecha · SHA y la fila WIP arriba; panel derecho de vidrio con el detalle o el panel de commit.

FORM: dirección fijada por el brief del usuario (GitKraken + vidrio + Ono), elegida en una ronda de tres opciones; seed: none (unavailable). Detalle distintivo: el **linaje de la rama**. Al elegir una rama, el gráfico ilumina sus commits propios, marca "nace acá" en el punto donde salió y "mergeada acá" en el merge, y atenúa el resto.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
