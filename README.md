# School Management — Web

Frontend administrativo de [school-management-api](https://github.com/Rivangel/school-management-api),
construido con **Angular 22** y **Angular Material**.

## Requisitos

- Node.js 20+ (probado con 24) y npm 10+
- La API corriendo en `http://localhost:8080` — sin ella el login no responde

## Puesta en marcha

```bash
npm install
npm start          # ng serve → http://localhost:4200
```

La API ya autoriza `http://localhost:4200` en `app.cors.allowed-origins`, así que no
hace falta proxy en desarrollo.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Build de producción en `dist/` |
| `npm test` | Tests unitarios (Vitest) |

## Configuración

`src/environments/` define a dónde pega el frontend:

| Archivo | Configuración | `apiUrl` |
|---|---|---|
| `environment.development.ts` | `ng serve` | `http://localhost:8080/api` |
| `environment.ts` | `ng build` (producción) | `/api` |

En producción la URL es **relativa** porque el frontend se sirve detrás de nginx junto
a la API: mismo origen, sin CORS y sin recompilar para cambiar de host.

## Estructura

```
src/app/
├── core/        # servicios, interceptores, guards y modelos (una sola instancia)
├── shared/      # componentes, pipes y directivas reutilizables sin dominio
└── features/    # un directorio por dominio, cargado con lazy loading
```

Cada carpeta tiene su propio `README.md` con la regla que la separa de las demás.

## Autenticación

1. `AuthService.login()` pega a `POST /api/auth/login` y guarda la sesión (token, email,
   nombre y rol) en `localStorage`, para que sobreviva a un F5.
2. `authInterceptor` añade `Authorization: Bearer <token>` **sólo** a las peticiones
   dirigidas a `environment.apiUrl`, y salta el login y el registro. El filtro por URL
   evita que el token viaje a un host ajeno si algún día se pide un recurso externo.
3. Al arrancar, la sesión guardada se valida antes de darse por buena: si el token está
   caducado o el JSON no tiene la forma esperada, se borra y el usuario vuelve al login.
   Sin eso la app enseñaría un menú de ADMIN mientras cada petición responde 401.

La firma del JWT **no** se verifica en el navegador — el secreto vive en la API. Los
claims sólo se leen para conocer la expiración y el rol.

## Rutas y guards

| Ruta | Protección | Qué muestra |
|---|---|---|
| `/login` | `invitadoGuard` | Formulario de acceso; reservado a quien **no** tiene sesión |
| `/acceso-denegado` | — | Aviso para quien entró con un rol sin permiso |
| `/` | `authGuard` | El shell (barra + menú); dentro, la portada y las secciones |
| `/alumnos`, `/maestros`, … | `rolGuard(…)` | Cada sección, con los roles que declara `core/navegacion.ts` |

- `authGuard` guarda la ruta pedida en `?returnUrl=` y el login vuelve a ella al entrar,
  de modo que un enlace directo no acabe siempre en la portada. El `returnUrl` sólo se
  respeta si es una ruta **interna**: si no, `/login?returnUrl=//sitio-falso.com`
  convertiría el login en un redirector abierto.
- `rolGuard('ADMIN', 'MAESTRO')` es una fábrica, porque cada ruta admite una lista
  distinta y `CanActivateFn` no recibe parámetros propios. Sin sesión manda al login;
  con sesión pero sin el rol, a `/acceso-denegado` — devolver al login a quien ya entró
  sólo consigue que choque otra vez contra la misma pared.

Los guards son **navegación, no seguridad**: sólo miran el token de `localStorage`. Quien
decide de verdad es la API, que responde 401/403 aunque el guard haya dejado pasar.

## Shell y menú

`features/shell/` es el marco de la aplicación: barra superior, menú lateral y el
`router-outlet` de las secciones. Se monta como componente de la ruta padre, así que al
navegar sólo cambia el contenido — la barra y el menú no se vuelven a construir.

- Las entradas del menú y sus roles están en **`core/navegacion.ts`**, y las rutas toman
  de ahí los roles con `rolesDe()`. Una sola lista: si el menú enseña algo que la ruta
  cierra, el enlace lleva a un "acceso denegado".
- El menú es fijo (`side`) a partir de 960 px y flotante (`over`) por debajo, donde se
  cierra solo al navegar. El estado por defecto lo decide el ancho y el usuario puede
  forzarlo con el botón (`linkedSignal`).
- Las secciones que aún no existen apuntan a `shared/components/proximamente/`, con su
  `rolGuard` ya puesto. Cada día siguiente sólo cambia el `loadComponent` de una ruta.

## Listados paginados

`GET /api/alumnos`, `/maestros` y `/materias` devuelven una página (`content`, `page`,
`size`, `totalElements`, …), no un arreglo. El listado de alumnos (`features/alumnos/`)
fija el patrón que reutilizan los demás:

- **Paginar y ordenar es cosa del servidor.** La tabla dibuja la página que llega y nada
  más — por eso no usa `MatTableDataSource`, que sólo sabe rebanar el arreglo que ya
  tiene en memoria y acabaría paginando 20 filas sobre un total de 300. El paginador
  toma su `length` de `totalElements`.
- **El estado vive en la URL** (`?page=&size=&sort=`), no en un signal del componente:
  recargar, compartir el enlace o volver con el botón "atrás" caen en la misma página y
  el mismo orden, y al volver de la ficha de un alumno el listado se reconstruye solo.
- **Lo que llega por la URL se valida** (`core/paginacion.ts`): la barra de direcciones
  es texto que cualquiera edita, y un `page=-1`, un `size=5000` o un `sort` por una
  propiedad que la API no conoce convertirían un enlace mal escrito en un 400.
- **Cambiar el orden vuelve a la página 0.** Los registros se recolocan, así que seguir
  en la página 7 no enseña "lo mismo ordenado" y puede dejar la pantalla vacía.
- Sin `sort` propio manda el de la API (apellido y nombre ascendente), y el encabezado lo
  marca: una tabla sin marcar sugeriría un orden arbitrario.

Los datos se piden con `rxResource`, que da `isLoading()` y `error()` como signals. Ojo:
su `value()` **lanza** cuando el recurso está en error, así que se lee a través de
`hasValue()` — si no, un 500 de la API revienta la detección de cambios en vez de
enseñar el aviso con el botón de reintentar.

## Decisiones

- **Standalone y zoneless.** El scaffold no usa NgModules ni `zone.js`; la detección de
  cambios va por signals, que es el camino soportado desde Angular 20.
- **Vitest en vez de Karma.** Karma está deprecado y Angular 22 genera el proyecto con
  Vitest; el API de `TestBed` es el mismo.
- **Material 3 con el tema azure/blue** vía `mat.theme()`, que define variables CSS
  (`--mat-sys-*`) — eso deja el tema oscuro del Día 34 como un cambio de `color-scheme`.

## Usuarios de prueba

Los que siembra la API (ver su README):

| Email | Contraseña | Rol |
|---|---|---|
| `admin@escuela.com` | `admin123` | ADMIN |
| `juan.perez@escuela.com` | `maestro123` | MAESTRO |
| `ana.lopez@escuela.com` | `alumno123` | ALUMNO |
