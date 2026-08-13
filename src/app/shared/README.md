# shared/

Piezas reutilizables **sin dominio propio**: se pueden usar desde cualquier feature
sin arrastrar nada más.

- `components/` — diálogo de confirmación, estado vacío, spinner, `proximamente/` (la
  pantalla que ocupa el lugar de las secciones aún no construidas), etc.
- `pipes/` y `directives/` — utilidades de plantilla.
- `paginador-en-espanol.ts` — textos del `mat-paginator`. Cada pantalla de listado lo
  provee en su propio `providers`, no la configuración raíz: importar el paginador desde
  `app.config.ts` lo metería en el bundle inicial, que es el que carga el login.

Regla: si un componente sabe qué es un alumno, no va aquí — va en su feature.
