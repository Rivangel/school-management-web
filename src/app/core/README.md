# core/

Lo que existe **una sola vez** en toda la aplicación y no se dibuja en pantalla:

- `services/` — servicios de dominio que hablan con la API (`AuthService`, `AlumnoService`, …).
- `interceptors/` — interceptores funcionales de `HttpClient` (JWT, manejo de errores).
- `guards/` — guards funcionales de ruta (`authGuard`, `roleGuard`).
- `models/` — interfaces TypeScript espejo de los DTOs de la API.
- `paginacion.ts` — traducción entre los query params de la URL (`page`, `size`, `sort`)
  y lo que espera la API. Lo comparten todas las pantallas de listado, y es donde se
  valida lo que llega escrito en la barra de direcciones.
- `navegacion.ts` — las secciones de la aplicación, los roles que las ven y los que
  pueden escribir en ellas (`ROLES_ESCRITURA`). Vive aquí, y no en el shell, porque el
  menú, los botones de acción y los `rolGuard` de las rutas leen la misma lista: si cada
  uno tuviera la suya, tarde o temprano dirían cosas distintas.
- `validadores.ts` — validadores de formulario que la API impone y Angular no trae
  (`textoRequerido`: un campo de sólo espacios está vacío para un `@NotBlank`).
- `services/errores-formulario.ts` — reparte un error de la API entre los campos del
  formulario y devuelve lo que no supo colocar, para enseñarlo como aviso general.

Regla: `core/` no importa de `features/`. Si algo aquí necesita saber de un feature,
la dependencia está al revés.
