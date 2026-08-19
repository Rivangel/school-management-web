# shared/

Piezas reutilizables **sin dominio propio**: se pueden usar desde cualquier feature
sin arrastrar nada más.

- `components/` — `confirmar/` (el diálogo de "esto no se puede deshacer", con el texto
  del botón a cargo de quien lo abre), `proximamente/` (la pantalla que ocupa el lugar de
  las secciones aún no construidas), estado vacío, spinner, etc.
- `pipes/` y `directives/` — utilidades de plantilla.
- `paginador-en-espanol.ts` — textos del `mat-paginator`. Cada pantalla de listado lo
  provee en su propio `providers`, no la configuración raíz: importar el paginador desde
  `app.config.ts` lo metería en el bundle inicial, que es el que carga el login.
- `listado-paginado.ts` — el estado de una pantalla de listado (qué página, en qué orden,
  si cargó o falló), leído de la URL. Lo comparten alumnos, maestros y los listados que
  vienen; el componente sólo pone columnas, cabecera y acciones. Sabe de páginas, no de
  alumnos, así que cumple la regla de abajo.
- `estilos/_listado.scss` — el aspecto de esas pantallas, traído con `@use` desde cada
  componente. No va en `styles.scss` porque la hoja global la carga también el login, que
  no dibuja ninguna tabla.

Regla: si un componente sabe qué es un alumno, no va aquí — va en su feature.
