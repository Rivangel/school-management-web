# shared/

Piezas reutilizables **sin dominio propio**: se pueden usar desde cualquier feature
sin arrastrar nada más.

- `components/` — diálogo de confirmación, estado vacío, spinner, `proximamente/` (la
  pantalla que ocupa el lugar de las secciones aún no construidas), etc.
- `pipes/` y `directives/` — utilidades de plantilla.

Regla: si un componente sabe qué es un alumno, no va aquí — va en su feature.
