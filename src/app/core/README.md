# core/

Lo que existe **una sola vez** en toda la aplicación y no se dibuja en pantalla:

- `services/` — servicios de dominio que hablan con la API (`AuthService`, `AlumnoService`, …).
- `interceptors/` — interceptores funcionales de `HttpClient` (JWT, manejo de errores).
- `guards/` — guards funcionales de ruta (`authGuard`, `roleGuard`).
- `models/` — interfaces TypeScript espejo de los DTOs de la API.

Regla: `core/` no importa de `features/`. Si algo aquí necesita saber de un feature,
la dependencia está al revés.
