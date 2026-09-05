# shared/

Piezas reutilizables **sin dominio propio**: se pueden usar desde cualquier feature
sin arrastrar nada más.

- `components/` — `confirmar/` (el diálogo de "esto no se puede deshacer", con el texto
  del botón a cargo de quien lo abre) y `grafica-barras/` (barras horizontales en SVG,
  con la serie repetida como tabla oculta para el lector de pantalla). La gráfica sabe de
  barras y no de materias: quien la usa le pasa las etiquetas ya calculadas, y las cuentas
  viven en `core/estadisticas.ts`. No hay librería de gráficas a propósito — ver el
  comentario de cabecera del componente.
- `pipes/` y `directives/` — utilidades de plantilla.
- `paginador-en-espanol.ts` — textos del `mat-paginator`. Cada pantalla de listado lo
  provee en su propio `providers`, no la configuración raíz: importar el paginador desde
  `app.config.ts` lo metería en el bundle inicial, que es el que carga el login.
- `listado-paginado.ts` — el estado de una pantalla de listado (qué página, en qué orden,
  con qué filtros, si cargó o falló), leído de la URL. Lo comparten alumnos, maestros,
  materias y los listados que vienen; el componente sólo pone columnas, cabecera,
  acciones y —si filtra— cómo se lee su filtro de la URL. Sabe de páginas, no de alumnos,
  así que cumple la regla de abajo.
- `id-de-ruta.ts` — el `:id` de la URL ya interpretado, con la distinción entre no traer
  segmento (un alta), traer un número (una edición) y traer algo que no lo es. Lo
  comparten los formularios y las fichas; perder el tercer caso es lo que hace que
  `/alumnos/abc/editar` abra un alta encubierta.
- `estilos/_listado.scss`, `_formulario.scss`, `_ficha.scss` — el aspecto de esas
  pantallas, traído con `@use` desde cada componente. No van en `styles.scss` porque la
  hoja global la carga también el login, que no dibuja ninguna de esas cajas.

Regla: si un componente sabe qué es un alumno, no va aquí — va en su feature.
