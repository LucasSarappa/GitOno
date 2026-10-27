---
name: GitOno
description: Cliente Git de escritorio con la organización de GitKraken, ocho temas (Crema y Cacao, del pelaje de Ono, por defecto), colores personalizables y paneles pegados o de vidrio.
colors:
  caramel: "#a35f2a"
  caramel-ink: "#8a4c1e"
  caramel-glow: "#e2a26a"
  apricot-focus: "#c98f5e"
  cream-ground: "#eee6dc"
  cream-solid: "#fbf7f2"
  cocoa-ink: "#2a1f18"
  cocoa-muted: "#66544a"
  cocoa-faint: "#76655a"
  cocoa-ground: "#16110e"
  cocoa-solid: "#211a16"
  bone-ink: "#f3e9df"
  added: "#2a7d4f"
  deleted: "#b93d33"
  modified: "#8f620c"
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

**Creative North Star: "Ono, vidrio cálido"** (tema por defecto) **dentro de la organización de GitKraken**

GitOno conserva la organización de GitKraken: pestañas de repos en la barra de título, una barra de herramientas con el ícono arriba y el nombre abajo, ramas a la izquierda, gráfico al centro y detalle a la derecha. Quien viene de ahí encuentra todo donde lo espera, y la curva de aprendizaje es corta. Desde la v0.6 los tres cuadros se pueden acomodar a cualquier lado (ver Layout).

**Temas.** El usuario elige entre ocho temas, cuatro claros (Crema, Papel, Niebla, Solar) y cuatro oscuros (Cacao, Abismo, Grafito, Alto contraste), y puede cambiar cualquiera de sus colores. Los de fábrica son **Crema** y **Cacao**: la paleta sale del pelaje de Ono, el caniche toy que le da nombre (neutros crema y damasco, acento caramelo; en oscuro, cacao y espresso). Abismo es el más parecido a GitKraken (azul profundo con turquesa), para quien viene de ahí.

**Paneles pegados por defecto.** Como GitKraken: paneles de borde a borde separados por líneas de 1 px, con una segunda capa neutra para la barra y los costados. El vidrio esmerilado (desenfoque de 28 px, paneles que flotan con 8 px de aire sobre un fondo con dos brillos suaves) queda como opción en Apariencia. La v0.6 lo apagó por defecto para bajar la carga visual (ver `docs/evaluacion-ux.md`).

El detalle distintivo es el **linaje de la rama**. Al elegir una rama, el gráfico resalta sus commits propios y el resto se atenúa al 32 %. Marca con una pastilla dónde nace ("nace acá", en caramelo) y dónde se mergeó ("mergeada en main", en verde). Una tarjeta de vidrio arriba del gráfico resume el linaje.

**Key Characteristics:**
- Estructura de GitKraken, sin inventar controles: botones, pestañas, selectores y listas estándar.
- El acento del tema (caramelo en Crema y Cacao) marca selección, acción principal y foco.
- Poca carga visual: por defecto, solo las columnas Rama / tag, Gráfico y Mensaje, con la foto del autor como nodo del gráfico.
- Vidrio funcional y opcional: si está prendido, hay contenido que pasa por debajo; nunca es adorno suelto.
- Color de carril por rama, que se repite en el gráfico, las etiquetas y los conectores.
- Letra del sistema para todo y monoespaciada solo para SHA, código y diffs.

## Colors

Cada tema define 21 colores base: fondo, paneles, menús, tres niveles de texto, el acento (con su versión para texto y el texto que va encima), los cuatro estados de archivo y los ocho carriles (`src/renderer/src/lib/themes.ts`). El resto sale de esos colores con `color-mix` en `styles.css`:
- bordes y tintes de hover: del texto, con transparencia;
- selección: del acento;
- vidrio: de los paneles;
- segunda capa de los costados: de los paneles y el fondo.

Así cualquier tema, también uno personalizado, queda coherente. Los ocho temas pasan un test de contraste WCAG AA (`themes.test.ts`); el editor de colores avisa si un cambio deja texto difícil de leer.

Lo que sigue describe **Crema** y **Cacao**, los temas de fábrica: una paleta restringida y cálida, con neutros tintados del pelaje de Ono, un solo acento y colores que hacen trabajo (estado de archivos y carriles del gráfico).

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
- **Verde agregado** (`added`), **Rojo borrado** (`deleted`), **Ámbar modificado** (`modified`) y **Azul renombrado** (`renamed`): íconos de estado (el ícono solo, de ese color, sin fondo, como GitKraken), conteos de líneas y fondos de líneas en los bloques. En oscuro se usan versiones más claras (ver `styles.css`).
- **"Preparar archivo"** es el único botón lleno de verde: es la acción que suma al commit. Aparece al pasar el mouse por un archivo, como en GitKraken.

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
- **Barra de herramientas** de unos 52 px:
  - el repo (clic: abrir la carpeta, una terminal o VS Code) y la rama actual;
  - Deshacer, Rehacer, Pull, Push, Rama, Stash y Pop, con el ícono arriba y el nombre abajo, como GitKraken;
  - la búsqueda de commits, la disposición, Historial/Comparar, la paleta de comandos y Apariencia.
- **Cuerpo en tres cuadros:** ramas (220 px), gráfico flexible y detalle (348 px). Con los paneles pegados los separa una línea de 1 px; con vidrio, 8 px de aire y 8 px de margen.

**Disposición acomodable** (`lib/dock.ts`). Cada panel lateral tiene una barra de título (30 px, en versalitas) que se arrastra a cualquier borde: izquierda, derecha, arriba o abajo, al lado del gráfico o de todo. El gráfico se arrastra desde el encabezado de sus columnas. Mientras se arrastra, un rectángulo del color de acento muestra dónde va a quedar. Todo se dibuja en una sola grilla CSS, así mover un panel no recrea los demás. Hay seis disposiciones prediseñadas en el menú Disposición, y Ctrl+K y Ctrl+J muestran u ocultan cada panel. Arriba o abajo, el panel de ramas reparte sus secciones en columnas.

La lista de commits muestra por defecto Rama/tag (156), Gráfico (según los carriles; 24 px por carril con fotos) y Mensaje. Autor (144), Fecha (112) y SHA (72) se suman con clic derecho en el encabezado. Si al mensaje le quedan menos de 240 px, se ocultan SHA, Fecha y Autor, en ese orden.

Ritmo de espacios: 4, 8, 12 y 16 px. Filas de 32 px en el historial y de 27–28 px en listas.

## Elevation & Depth

Vidrio en capas: el fondo cálido, los paneles translúcidos encima y las ventanas emergentes (menú de apariencia) más opacas y con más sombra. Cada panel tiene un brillo de 1 px arriba (un borde interno claro) y una sombra con desplazamiento.

### Shadow Vocabulary
- **Panel** (`0 1px 0 <brillo> inset, 0 10px 28px -16px rgba(74,44,22,.32), 0 2px 6px -3px rgba(74,44,22,.10)` en claro): paneles, barra de herramientas y pestaña activa.
- **Emergente** (`0 22px 48px -18px rgba(60,35,18,.42), 0 4px 12px -4px rgba(60,35,18,.14)` en claro): menú de apariencia.

### Named Rules
**La regla del vidrio con contenido.** El desenfoque solo se usa donde algo pasa por debajo (encabezados fijos, menús, paneles sobre el fondo). Con el vidrio apagado (lo normal desde la v0.6), o si el sistema pide menos transparencia, todo pasa a ser sólido y los paneles se pegan; nada se rompe.

## Shapes

- **Radios:** curvas suaves y consistentes: 12px para paneles, 10px para tarjetas y bloques, 8px para botones, campos y pestañas, y 6px para etiquetas de rama. Las pastillas (chips, insignias, marcas de linaje) son totalmente redondeadas.
- **Bordes:** de 1px con baja opacidad, sin franjas de color a los costados.
- **Nodos del gráfico:**
  - commit: la foto (o las iniciales) del autor, de 20 px, dentro de un aro del color del carril, como GitKraken. Se puede apagar en Apariencia: queda un círculo lleno;
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
- **Rama local:** borde del color del carril y un tinte suave del mismo color (16 %), con texto normal. Los íconos van a la derecha: computadora (local) y nube (en el servidor).
- **Rama remota:** igual, con un tinte más suave (9 %).
- **Tag:** borde neutro con el ícono de tag.
- **Rama actual:** la única llena con el color del carril, con ✓.
- **Varias en el mismo commit:** se ve una y un "+N". Al apoyar el mouse se despliegan todas hacia abajo, cada una con su menú y arrastrable.
- **Rama fantasma:** al pasar el mouse por un commit sin etiquetas (o al elegirlo), su rama más cercana aparece tenue y punteada, como en GitKraken.
- Una línea punteada del color del carril une cada etiqueta con su nodo.

### Perfil
- **Botón:** la foto del usuario (26px, redonda) arriba a la derecha de la barra de título; al pasar el mouse, un aro caramelo.
- **Menú:** la identidad en uso (foto de 40px, nombre, email y una pastilla "En todos los repos" o "Solo en <repo>"), la lista de perfiles (el que está en uso, con fondo de selección y ✓) y "Nuevo perfil…". "Solo acá", editar y borrar aparecen al pasar el mouse por un perfil.

### Paneles ocultos
- **Pestaña en el borde:** un panel oculto deja una pestaña chica pegada al borde del gráfico donde estaba (vertical a los costados, horizontal arriba o abajo), con ícono y nombre. Va tenue (78 %) hasta que se le pasa el mouse, y entonces se tiñe de caramelo.

### Stashes en el gráfico
- **Fila del stash:** el nodo es una caja dibujada con el color gris de las filas virtuales, unida con línea punteada a su commit base; el mensaje va en cursiva y en texto secundario, como la fila WIP.

### Panel de detalle
- Compacto, como GitKraken:
  - asunto (14px);
  - autor y fecha en una sola línea;
  - SHA, padres y ramas como chips;
  - descripción recortada a 3 líneas con "Ver más";
  - archivos en árbol o lista.
- El menú ⋯ del panel elige qué secciones se ven.

### Linaje de la rama (componente distintivo)
- **Se pide, no aparece solo:** un clic en una rama va a su commit. El linaje se abre con la mira del panel de ramas o con "Ver de dónde sale".
- **Tarjeta:** arriba del panel de detalle, teñida del acento y en columna; si el detalle está oculto, va arriba del gráfico, con vidrio. Muestra de dónde sale (con enlace al commit), desde dónde se creó, cuántos commits propios tiene, si se mergeó (enlace al merge) y un botón para comparar con la principal.
- **En la lista:** las filas del linaje en negrita con halo en el nodo, el resto atenuado al 32 %, y pastillas "nace acá" (caramelo) y "mergeada en <rama>" (verde).

## Do's and Don'ts

### Do:
- **Do** usar el color del carril para todo lo que pertenece a una rama: nodo, líneas, conector y etiqueta.
- **Do** dar el caramelo solo a selección, acción principal, foco y estado activo.
- **Do** usar íconos Lucide de trazo 1,75 (2–2,75 en tamaños de 11–12px) en todos los controles.
- **Do** probar cada pantalla en claro, en oscuro, con el vidrio apagado y prendido, y con al menos un tema que no sea el de fábrica.
- **Do** derivar los colores nuevos de los colores base del tema (`color-mix`), nunca fijarlos: tienen que seguir a los temas y a los colores del usuario.
- **Do** ocultar columnas antes que cortar el mensaje del commit.

### Don't:
- **Don't** usar caracteres Unicode o emojis como íconos (›, ↺, ⇄): se reemplazaron por íconos reales.
- **Don't** poner franjas de color de más de 1px a los costados de filas o bloques. La selección se marca con el fondo.
- **Don't** agregar desenfoque donde no pasa contenido por debajo.
- **Don't** mostrar controles de funciones que todavía no existen.
- **Don't** escribir colores fijos en `styles.css` fuera del bloque de tokens: un color fijo no sigue al tema.
- **Don't** sumar columnas, barras o bordes por defecto: lo que no está en GitKraken, se activa a pedido.
