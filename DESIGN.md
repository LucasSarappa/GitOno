---
name: GitOno
description: Cliente Git de escritorio inspirado en GitKraken, con la paleta del pelaje de Ono y paneles de vidrio cálido.
colors:
  caramel: "#a35f2a"
  caramel-ink: "#8a4c1e"
  caramel-glow: "#e2a26a"
  apricot-focus: "#c98f5e"
  cream-ground: "#eee6dc"
  cream-solid: "#fbf7f2"
  cocoa-ink: "#2a1f18"
  cocoa-muted: "#66544a"
  cocoa-faint: "#7c6a5d"
  cocoa-ground: "#16110e"
  cocoa-solid: "#211a16"
  bone-ink: "#f3e9df"
  added: "#2f8a57"
  deleted: "#c2453a"
  modified: "#a7720f"
  renamed: "#2f6fbf"
  lane-caramel: "#d9822b"
  lane-sky: "#3d84c6"
  lane-mint: "#2f9e6c"
  lane-raspberry: "#c74f74"
  lane-violet: "#8467c9"
  lane-teal: "#1f9a9a"
  lane-mustard: "#b8922a"
  lane-slate: "#6f7f90"
typography:
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, SF Pro Text, Ubuntu, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.35
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, SF Pro Text, Ubuntu, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, SF Pro Text, Ubuntu, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
  mono:
    fontFamily: "Cascadia Mono, SF Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  pill: "6px"
  sm: "6px"
  md: "8px"
  card: "10px"
  panel: "12px"
spacing:
  gutter: "8px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.caramel}"
    textColor: "{colors.cream-solid}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 11px"
  button-secondary:
    backgroundColor: "{colors.cream-solid}"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 11px"
  field:
    backgroundColor: "{colors.cream-solid}"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 9px"
  repo-tab-active:
    backgroundColor: "{colors.cream-solid}"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.md}"
    height: "30px"
  ref-pill-local:
    backgroundColor: "{colors.lane-caramel}"
    textColor: "{colors.cream-solid}"
    rounded: "{rounded.pill}"
    height: "21px"
    padding: "0 7px"
---

# Design System: GitOno

## Overview

**Creative North Star: "Ono, vidrio cálido"**

GitOno conserva la organización de GitKraken: pestañas de repos en la barra de título, ramas a la izquierda, gráfico al centro y detalle a la derecha. Quien viene de ahí encuentra todo donde lo espera. El mundo visual cambia: la paleta sale del pelaje de Ono, el caniche toy que le da nombre. Hay neutros crema y damasco, acento caramelo y, en oscuro, tonos cacao y espresso en vez del azul marino con neón de la categoría.

Los paneles son de vidrio esmerilado (desenfoque de 28 px y saturación 160 %) y flotan con 8 px de aire sobre un fondo cálido con dos brillos suaves. El vidrio cumple una función: el encabezado de la lista de commits y el de cada sección de cambios locales quedan fijos, y el contenido pasa por debajo, desenfocado. Es una herramienta de trabajo diario: densa, legible y con la marca en los detalles.

El detalle distintivo es el **linaje de la rama**. Al elegir una rama, el gráfico resalta sus commits propios y el resto se atenúa al 32 %. Marca con una pastilla dónde nace ("nace acá", en caramelo) y dónde se mergeó ("mergeada en main", en verde). Una tarjeta de vidrio arriba del gráfico resume el linaje.

**Key Characteristics:**
- Estructura de GitKraken, sin inventar controles: botones, pestañas, selectores y listas estándar.
- Paleta cálida en los dos temas. El acento caramelo marca selección, acción principal y foco.
- Vidrio funcional: hay contenido que pasa por debajo, nunca es adorno suelto.
- Color de carril por rama, que se repite en el gráfico, las etiquetas y los conectores.
- Letra del sistema para todo y monoespaciada solo para SHA, código y diffs.

## Colors

Restringida y cálida: neutros tintados del pelaje de Ono, un solo acento y colores que hacen trabajo (estado de archivos y carriles del gráfico).

### Primary
- **Caramelo** (`caramel`): botón principal, interruptores encendidos y la etiqueta de un carril seleccionado. En oscuro se usa **Caramelo claro** (`caramel-glow`), con texto oscuro encima.
- **Caramelo tinta** (`caramel-ink`): texto de acento sobre fondos claros: enlaces, rama actual en la barra y título de la tarjeta de linaje.
- **Damasco de foco** (`apricot-focus`): anillo de foco y borde de campos activos.

### Neutral
- **Crema de fondo** (`cream-ground`): fondo de la ventana en claro, debajo de los paneles.
- **Crema sólida** (`cream-solid`): editor de diffs, bloques y paneles cuando el vidrio está apagado.
- **Tinta cacao** (`cocoa-ink`), **Cacao suave** (`cocoa-muted`) y **Cacao tenue** (`cocoa-faint`): texto principal, secundario y terciario o de placeholder en claro. El terciario cumple contraste 4,8:1 sobre crema sólida.
- **Fondo cacao** (`cocoa-ground`), **Cacao sólido** (`cocoa-solid`) y **Hueso** (`bone-ink`): sus equivalentes en oscuro.

### Estado de archivos
- **Verde agregado** (`added`), **Rojo borrado** (`deleted`), **Ámbar modificado** (`modified`) y **Azul renombrado** (`renamed`): insignias de estado (ícono sobre el color), conteos de líneas y fondos de líneas en los bloques. En oscuro se usan versiones más claras (ver `styles.css`).

### Carriles del gráfico
Ocho colores, en orden: caramelo, cielo, menta, frambuesa, violeta, verde azulado, mostaza y pizarra (`lane-*`). Cada uno tiene su versión para oscuro. La fila WIP usa un gris cálido propio.

### Named Rules
**La regla del color que trabaja.** El caramelo solo aparece en selección, acción principal, foco y estado activo. Los colores de carril solo identifican ramas. Ningún color es decoración.

**La regla de la paleta compartida.** El color de un carril es el mismo en el nodo, las líneas, el conector y la etiqueta de la rama. Si una rama es frambuesa, todo lo suyo es frambuesa.

## Typography

**Body Font:** la del sistema (Segoe UI Variable en Windows, SF Pro en macOS, Ubuntu o Cantarell en Linux)
**Label/Mono Font:** Cascadia Mono, SF Mono o ui-monospace

**Character:** una sola familia de trabajo, ajustada y densa como en un IDE. La monoespaciada se reserva para datos: SHA, rangos de bloques, código y atajos de teclado.

### Hierarchy
- **Title** (650, 15px, 1,35): asunto del commit en el panel de detalle y título del panel de cambios.
- **Body** (400, 13px, 1,45): todo el resto de la interfaz.
- **Label** (600, 12px): títulos de sección, encabezados de columna (11,5px) y etiquetas de ramas (11,5px).
- **Mono** (12px): SHA, código, diffs (12,5px) y números de línea (11,5px).

Los números de las tablas usan cifras de ancho fijo (`tabular-nums`).

### Named Rules
**La regla de una sola voz.** Una sola familia sans para toda la interfaz. La jerarquía sale del peso (400, 600 y 650) y de saltos chicos de tamaño, nunca de otra tipografía.

## Layout

La ventana tiene una barra de título de 40 px con el logo y las pestañas. Debajo, cada repo tiene su espacio de trabajo:
- **Barra de herramientas** de 46 px: repo, rama actual, Historial/Comparar, Actualizar y Apariencia.
- **Cuerpo en tres paneles:** ramas (220 px), centro flexible y detalle (348 px), con 8 px de separación y 8 px de margen.

A menos de 1240 px de ancho, los paneles laterales pasan a 196 y 316 px.

La lista de commits tiene columnas de ancho fijo: Rama/tag (156), Gráfico (según los carriles), Autor (144), Fecha (112) y SHA (72). El mensaje se queda con el resto. Si al mensaje le quedan menos de 240 px, se ocultan SHA, Fecha y Autor, en ese orden.

Ritmo de espacios: 4, 8, 12 y 16 px. Filas de 32 px en el historial y de 27–28 px en listas.

## Elevation & Depth

Vidrio en capas: el fondo cálido, los paneles translúcidos encima y las ventanas emergentes (menú de apariencia) más opacas y con más sombra. Cada panel tiene un brillo de 1 px arriba (un borde interno claro) y una sombra con desplazamiento.

### Shadow Vocabulary
- **Panel** (`0 1px 0 <brillo> inset, 0 10px 28px -16px rgba(74,44,22,.32), 0 2px 6px -3px rgba(74,44,22,.10)` en claro): paneles, barra de herramientas y pestaña activa.
- **Emergente** (`0 22px 48px -18px rgba(60,35,18,.42), 0 4px 12px -4px rgba(60,35,18,.14)` en claro): menú de apariencia.

### Named Rules
**La regla del vidrio con contenido.** El desenfoque solo se usa donde algo pasa por debajo (encabezados fijos, menús, paneles sobre el fondo). Con el vidrio apagado, o si el sistema pide menos transparencia, todo pasa a ser sólido y nada se rompe.

## Shapes

- **Radios:** curvas suaves y consistentes: 12px para paneles, 10px para tarjetas y bloques, 8px para botones, campos y pestañas, y 6px para etiquetas de rama. Las pastillas (chips, insignias, marcas de linaje) son totalmente redondeadas.
- **Bordes:** de 1px con baja opacidad, sin franjas de color a los costados.
- **Nodos del gráfico:**
  - commit: círculo lleno;
  - merge: círculo hueco con borde;
  - fila WIP: círculo punteado;
  - HEAD y commits del linaje: halo.

## Components

### Buttons
- **Shape:** esquinas de 8px; alto de 28px (24px los chicos y 34px el grande).
- **Primary:** caramelo con texto claro, con un brillo interno arriba y una sombra cálida.
- **Secondary:** fondo de vidrio más opaco y borde de 1px; al pasar el mouse se tiñe apenas.
- **Ghost:** transparente; al pasar el mouse aparece el tinte. Se usa en botones de solo ícono.
- **States:** al presionar baja medio píxel; deshabilitado al 45 %; foco con anillo damasco de 2px.

### Chips
- **Style:** pastilla con borde, para las ramas que contienen un commit; al pasar el mouse, el borde y el texto se vuelven caramelo.

### Inputs / Fields
- **Style:** fondo de vidrio opaco, borde de 1px y radio de 8px. El campo de búsqueda lleva un ícono adentro.
- **Focus:** borde damasco más un halo de 3px al 25 %.

### Navigation
- **Pestañas de repos:** en la barra de título. La activa es una pastilla de vidrio con sombra y el ícono en caramelo. La × aparece al pasar el mouse; clic con la rueda o Ctrl+W cierra.
- **Selector de vistas:** control segmentado sobre fondo hundido; la opción activa se eleva.

### Etiquetas de ramas y tags
- **Rama local:** llena con el color de su carril.
- **Rama remota:** contorno del carril con un fondo apenas teñido.
- **Tag:** contorno punteado.
- **Rama actual:** lleva ✓ y un contorno separado.
- **Local y remota en el mismo commit:** una sola etiqueta con los íconos de computadora y nube.
- Una línea punteada del color del carril une cada etiqueta con su nodo.

### Linaje de la rama (componente distintivo)
- **Tarjeta:** vidrio teñido de caramelo arriba del gráfico. Muestra de dónde sale (con enlace al commit), desde dónde se creó, cuántos commits propios tiene, si se mergeó (enlace al merge) y un botón para comparar con la principal.
- **En la lista:** las filas del linaje en negrita con halo en el nodo, el resto atenuado al 32 %, y pastillas "nace acá" (caramelo) y "mergeada en <rama>" (verde).

## Do's and Don'ts

### Do:
- **Do** usar el color del carril para todo lo que pertenece a una rama: nodo, líneas, conector y etiqueta.
- **Do** dar el caramelo solo a selección, acción principal, foco y estado activo.
- **Do** usar íconos Lucide de trazo 1,75 (2–2,75 en tamaños de 11–12px) en todos los controles.
- **Do** probar cada pantalla en claro, en oscuro y con el vidrio apagado.
- **Do** ocultar columnas antes que cortar el mensaje del commit.

### Don't:
- **Don't** usar caracteres Unicode o emojis como íconos (›, ↺, ⇄): se reemplazaron por íconos reales.
- **Don't** poner franjas de color de más de 1px a los costados de filas o bloques. La selección se marca con el fondo.
- **Don't** agregar desenfoque donde no pasa contenido por debajo.
- **Don't** mostrar controles de funciones que todavía no existen (pull, push, merge… hasta la etapa 3).
- **Don't** volver al azul marino con neón de GitKraken: el oscuro de GitOno es cacao.
