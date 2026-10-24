# Evaluación de la interfaz de GitOno v0.5: carga visual y familiaridad con GitKraken

Evaluación heurística (método `/evaluate` de [Design with Intent](https://designwithintent.ai/)) de la pantalla de historial de la v0.5, en oscuro, con un repo de ejemplo de 13 commits y 5 ramas. La pregunta: ¿qué hace que la pantalla pese más que la de GitKraken y le cueste más a quien viene de ahí?

## Veredicto de anti-patrones

Limpio. No hay patrones engañosos: no hay cuenta obligatoria, pedidos de red ocultos ni opciones marcadas de antemano. Los avatares se pueden apagar y el fetch es manual.

## Problemas prioritarios

### Mayores

**Etiquetas de rama como bloques de color saturado.** Las ramas locales se pintan con el color del carril de fondo y texto blanco. Con cinco o seis ramas, la columna izquierda se lleva la mirada antes que los mensajes, que son lo que se lee. GitKraken usa una etiqueta oscura, con el borde y un tinte suave del color del carril. Viola *diseño estético y minimalista*.
→ Etiquetas con un tinte suave del carril, borde del carril y texto normal. El color fuerte queda solo para la rama actual.

**Columnas que GitKraken no muestra por defecto.** Autor (con avatar), Fecha y SHA ocupan 330 px en cada fila. GitKraken muestra por defecto Rama / tag, Gráfico y Mensaje, y pone la foto del autor en el nodo del gráfico. Viola *diseño estético y minimalista* y *consistencia y estándares* (lo que el usuario ya conoce).
→ Por defecto, solo Rama / tag, Gráfico y Mensaje, con el avatar del autor como nodo del gráfico. Las demás columnas se activan con clic derecho en el encabezado.

**Tres barras antes del contenido.** Pestañas, barra de herramientas y barra de búsqueda del historial apilan 140 px de controles antes de la primera fila. GitKraken tiene dos: pestañas y barra de herramientas. Viola *diseño estético y minimalista*.
→ Llevar la búsqueda a la barra de herramientas (Ctrl+F) y los botones de paneles a un menú de disposición. Sacar la barra del historial.

### Menores

**Paneles como tarjetas flotantes.** Tres tarjetas con vidrio, radio de 12 px, sombra y 8 px de separación sobre un fondo con degradé. Cada borde suma una línea que el ojo recorre. GitKraken pega los paneles y los separa con una línea de 1 px. Viola *diseño estético y minimalista*.
→ Por defecto, paneles pegados con divisores finos y fondo liso. El vidrio queda como opción y, si se activa, vuelven las tarjetas flotantes.

**Encabezados de columna distintos a los de GitKraken.** "Rama / tag", "Gráfico", "Mensaje" en minúscula y gris medio. GitKraken usa "BRANCH / TAG · GRAPH · COMMIT MESSAGE" en mayúsculas chicas. Viola *consistencia y estándares*.
→ Encabezados en versalitas chicas, más tenues.

**Fila WIP en texto.** "1 sin preparar · 2 preparados" se lee, pero GitKraken muestra íconos con cantidades (lápiz 25, más 15), que se reconocen de un vistazo. Viola *reconocer antes que recordar*.
→ Íconos por tipo de cambio (modificados, nuevos, borrados, en conflicto) con su cantidad.

### Cosméticos

**Qué rama tiene un commit sin etiqueta.** Al pasar por un commit viejo no se sabe a qué rama pertenece sin mirar el panel de detalle. GitKraken muestra una "rama fantasma" tenue en la columna de etiquetas. Viola *visibilidad del estado del sistema*.
→ Al pasar el mouse por un commit (o al elegirlo), mostrar la rama más cercana que lo contiene, tenue, en su columna.

**Etiquetas "+1" que no se pueden abrir.** Cuando un commit tiene varias ramas, el "+1" solo muestra un tooltip. GitKraken despliega la lista al apoyar el mouse. Viola *reconocer antes que recordar*.
→ Al apoyar el mouse, desplegar todas las etiquetas del commit, cada una con su menú y arrastrable.

## Veredictos por heurística

- Visibilidad del estado del sistema: se sostiene con tensión. Lo decide *Qué rama tiene un commit sin etiqueta*. Además, pull, push y fetch no muestran progreso.
- Coincidencia con el mundo real: se sostiene.
- Control y libertad: se sostiene (Deshacer y Rehacer, Abortar y Continuar).
- Consistencia y estándares: tenso. Lo decide *Columnas que GitKraken no muestra por defecto*.
- Prevención de errores: se sostiene (confirmaciones y el error dentro del diálogo).
- Reconocer antes que recordar: tenso. Lo decide *Fila WIP en texto*.
- Flexibilidad y eficiencia: tenso. No hay paleta de comandos ni zoom, y los paneles no se pueden reacomodar.
- Diseño estético y minimalista: roto. Lo decide *Etiquetas de rama como bloques de color saturado*.
- Ayudar a reconocer y recuperarse de errores: se sostiene.
- Ayuda y documentación: tenso. No hay una lista de atajos dentro de la app.

## Hallazgos positivos

- El linaje de la rama (resaltado, "nace acá", "mergeada en") no tiene equivalente en GitKraken: hay que protegerlo.
- El color de cada carril es el mismo en el nodo, las líneas y la etiqueta: ayuda a seguir una rama.
- Los menús de clic derecho siguen el orden de GitKraken y suman Deshacer en todo.
- Los avisos de operación a medio hacer dicen qué hacer y tienen Abortar y Continuar a mano.

## Acciones recomendadas

En este orden:

- Etiquetas de rama como bloques de color saturado
- Columnas que GitKraken no muestra por defecto
- Tres barras antes del contenido
- Paneles como tarjetas flotantes
- Fila WIP en texto
- Encabezados de columna distintos a los de GitKraken
- Qué rama tiene un commit sin etiqueta
- Etiquetas "+1" que no se pueden abrir
