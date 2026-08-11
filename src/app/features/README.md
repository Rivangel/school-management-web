# features/

Un directorio por dominio (`auth/`, `alumnos/`, `maestros/`, `materias/`,
`calificaciones/`, `asistencia/`, `dashboard/`), cada uno con sus componentes y sus
rutas.

Las rutas se cargan con `loadChildren`/`loadComponent` desde `app.routes.ts`, de modo
que cada feature viaje en su propio bundle y el login no cargue el dashboard entero.
