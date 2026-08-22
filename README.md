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
`size`, `totalElements`, …), no un arreglo. Todas las pantallas de listado
(`features/alumnos/`, `features/maestros/`, `features/materias/`) comparten el mismo
estado, que vive en **`shared/listado-paginado.ts`**; el componente pone las columnas, la
cabecera y las acciones, que es donde los listados se diferencian de verdad:

```ts
protected readonly listado = listadoPaginado({
  ordenables: ORDENABLES,
  ordenPorDefecto: 'apellido,asc',
  cargar: (consulta) => this.maestros.listar(consulta),
  mensajeDeFallo: 'No se pudo cargar el listado de maestros.',
});
```

- **Paginar y ordenar es cosa del servidor.** La tabla dibuja la página que llega y nada
  más — por eso no usa `MatTableDataSource`, que sólo sabe rebanar el arreglo que ya
  tiene en memoria y acabaría paginando 20 filas sobre un total de 300. El paginador
  toma su `length` de `totalElements`.
- **El estado vive en la URL** (`?page=&size=&sort=`), no en un signal del componente:
  recargar, compartir el enlace o volver con el botón "atrás" caen en la misma página y
  el mismo orden, y al volver de la ficha de un alumno el listado se reconstruye solo.
- **Lo que llega por la URL se valida** (`core/paginacion.ts`) contra `ordenables`, que es
  también la lista de columnas que se pueden pulsar: la barra de direcciones es texto que
  cualquiera edita, y un `page=-1`, un `size=5000` o un `sort` por una propiedad que la
  API no conoce convertirían un enlace mal escrito en un 400. Ojo al llegar de otra
  sección: `?sort=grupo,asc` es válido en alumnos y no existe en maestros.
- **Cambiar el orden vuelve a la página 0.** Los registros se recolocan, así que seguir
  en la página 7 no enseña "lo mismo ordenado" y puede dejar la pantalla vacía.
- **Una página fuera de rango cae sola en la última con datos.** Pasa al volver de una
  ficha después de borrar y con un `?page=99` escrito a mano; sin esto la tabla se queda
  en blanco sin explicar nada.
- Sin `sort` propio manda el de la API (apellido y nombre ascendente), y el encabezado lo
  marca con `ordenPorDefecto`: una tabla sin marcar sugeriría un orden arbitrario.
- **Los filtros son del servidor y viven en la URL como todo lo demás.** Materias filtra
  por maestro (`?maestroId=2`, `leerFiltros` en las opciones del listado) y ese parámetro
  viaja a la API: quedarse con las filas de un maestro **en el cliente** sólo alcanzaría
  a las 20 que tiene la página en memoria, y el paginador seguiría contando todas. Como
  el `sort`, se valida antes de viajar. Cambiar el filtro vuelve a la página 0 — al
  filtrar quedan menos registros y la página que se miraba puede no existir.

El selector de maestro de `/materias` pide su propia lista (`?size=100`, el tope de la
API) y ofrece "Todos los maestros" para quitar el filtro. Es un desplegable y no un
buscador porque la plantilla de una escuela cabe entera en él; el día que pase de cien
maestros habrá que cambiarlo por un campo que consulte al escribir. Cuando el filtro deja
la tabla vacía, el aviso lo dice con esas palabras ("este maestro no tiene materias
asignadas") en vez de sugerir que la escuela no tiene ninguna.

> **Ese selector no lo ve todo el mundo.** `/materias` está abierta a los tres roles y
> `/maestros` no, así que el ALUMNO pedía una lista que volvía como **403 en silencio** —el
> servicio va con `sinAvisoGlobal()`— y se quedaba con un desplegable vacío que no
> filtraba nada. Ahora el `rxResource` deja sus `params` en `undefined` cuando el rol no
> da, y la petición condenada ni se manda. El filtro puede llegar igualmente en un enlace
> compartido (`?maestroId=2`), y sin selector no habría forma de volver al listado
> completo: para eso está el botón "Ver todas".

Los datos se piden con `rxResource`, que da `isLoading()` y `error()` como signals. Ojo:
su `value()` **lanza** cuando el recurso está en error, así que se lee a través de
`hasValue()` — si no, un 500 de la API revienta la detección de cambios en vez de
enseñar el aviso con el botón de reintentar.

El aspecto (cabecera, caja de la tabla, aviso vacío y de error) va en
`shared/estilos/_listado.scss` y cada pantalla lo trae con `@use`, en vez de vivir en
`styles.scss`: la hoja global la carga el login, que no dibuja ninguna tabla. Las
pantallas de formulario y de ficha hacen lo mismo con `_formulario.scss` y `_ficha.scss`;
lo que cada una tiene de propio —qué columna se esconde en móvil, qué campo ocupa el ancho
completo— se queda en su componente.

## Formularios

`features/alumnos/formulario-alumno/` fijó el patrón de alta y edición; `maestros/` y
`materias/` lo repiten (Días 20–24 siguen):

- **Es una ruta, no un diálogo.** `/alumnos/nuevo` y `/alumnos/7/editar` se comparten,
  se recargan y se cierran con el botón "atrás" como cualquier otra pantalla, igual que
  el listado. Los enlaces llevan `queryParamsHandling="preserve"` para arrastrar el
  `?page=&size=&sort=` del listado: al guardar se vuelve **a la página desde la que se
  entró**, sin guardar estado en ningún lado.
- **Un componente para los dos modos.** Sin `id` en la ruta es un alta y el recurso ni
  llega a pedir nada. Un id que no es un número (`/alumnos/abc/editar`) se distingue del
  alta a propósito: si no, el formulario abriría vacío y el primer guardado crearía un
  alumno que nadie pidió. Esa lectura de tres respuestas —no hay segmento, hay un número,
  hay algo que no lo es— vive en **`shared/id-de-ruta.ts`**, que comparten los cuatro
  formularios y fichas. Va por el `paramMap` y no por el `snapshot` porque el router
  **reutiliza** el componente entre `/maestros/7` y `/maestros/9`: con el snapshot, la
  pantalla se quedaría enseñando al anterior.
- **Las validaciones espejan el DTO** (`AlumnoRequest`) campo a campo. `textoRequerido`
  sustituye a `Validators.required` porque este da por bueno un campo de sólo espacios,
  que el `@NotBlank` de la API rechaza después del viaje.
- **Lo que objeta la API se marca en su campo** (`core/services/errores-formulario.ts`).
  Hay dos formas de error y la diferencia importa: los 400 de validación traen el mapa
  `detalles` (campo → mensaje) y se reparten solos; los 400 de negocio ("Ya existe un
  alumno con la matrícula A-001") llegan como una frase suelta y se colocan por pistas
  sobre el texto. Lo que ninguna pista reconoce **se enseña al pie** en vez de
  descartarse, así que reescribir un mensaje en la API degrada el error a aviso general
  en lugar de hacerlo desaparecer.
- Ese error se borra solo al editar el campo: cambiar el valor recalcula los validadores
  del control y reemplaza su mapa de errores. De eso depende que el formulario no se
  quede bloqueado por una objeción ya corregida.
- **Una pista puede traer su propio texto** (`mensaje` en `PistaDeCampo`). Lo normal es
  enseñar la frase de la API, que se lee bien bajo el campo; hace falta cambiarla cuando
  la API habla de algo que el usuario no ha visto — ver el maestro del formulario de
  materias, aquí abajo.

### El campo que apunta a otro registro

`features/materias/formulario-materia/` es el primero que no se rellena entero
escribiendo: la materia guarda el **id** de su maestro, no su nombre.

- La pantalla pide las dos cosas a la vez (la materia y los maestros) y **espera a las
  dos** antes de habilitar el `fieldset`: un desplegable que se abre sin opciones parece
  roto, y en una edición elegir antes de que llegue la ficha sólo consigue que la
  respuesta pise lo elegido.
- Las opciones incluyen **siempre la del maestro que la materia ya tiene**, etiquetada con
  el `maestroNombre` que la respuesta trae compuesto. La API devuelve como mucho cien
  maestros: sin esa red, una materia cuyo maestro se quedó fuera de la página dibujaría el
  `mat-select` vacío —como si no tuviera ninguno— y editarla para corregir el nombre la
  reasignaría sin querer.
- Elegir a un maestro que ya no existe **no vuelve como un 400**: la API lo busca antes de
  guardar, así que responde **404** con "Maestro con id 3 no encontrado", un id que quien
  rellenó el formulario nunca vio porque eligió un nombre en una lista. La pista lo cuelga
  del desplegable con palabras propias ("ese maestro ya no existe, elige otro") y el fallo
  **vuelve a pedir la lista**, que es lo que permite resolverlo sin recargar la pantalla.
  En una edición ese 404 es ambiguo —puede faltar la materia o el maestro— y lo único que
  los distingue es el mensaje.
- El nombre de una materia **no es único** en la API: dos grupos pueden llamar igual a
  Álgebra, así que su formulario no tiene ninguna pista de duplicados. Copiar la de
  maestros habría dejado una regla que no dispara nunca.

Las escrituras son **sólo del ADMIN** (`ROLES_ESCRITURA` en `core/navegacion.ts`, espejo
de `SecurityConfig`). Los listados ocultan el botón de alta y el enlace de edición a quien
no la tiene, y las rutas del formulario leen esa misma lista en su `rolGuard`: ocultar no
protege —la API responde 403 igual—, pero un botón que sólo lleva a "acceso denegado"
sobra. La ficha sí la ve: consultarla la puede todo el que llegue al listado.

En materias eso se nota más que en las otras dos secciones, porque su listado está abierto
a los tres roles y la mayoría de quienes lo abren no verán ninguna acción de escritura. Su
ficha lleva la misma idea un paso más: el nombre del maestro es **enlace a `/maestros/2`
sólo para quien puede abrir esa sección**; para el ALUMNO es texto, porque el enlace sería
un viaje a "acceso denegado".

## Ficha y borrado

`/alumnos/7` enseña la ficha completa y es **desde donde se borra**, no desde una fila
del listado: decidir sobre alguien de quien sólo se ven cinco columnas es fácil de
hacer mal. La confirmación (`shared/components/confirmar/`) nombra a quien se va a
eliminar y su matrícula, y su botón dice la acción ("Eliminar") en vez de "Aceptar", que
obliga a releer el mensaje para saber qué se está aceptando. Escapar, pulsar el fondo o
cancelar cierran sin confirmar.

El listado corrige por su cuenta una página que se quedó **fuera de rango**: al volver
de un borrado la página que se miraba puede haber dejado de existir, y un `?page=99`
escrito a mano dejaría la tabla en blanco sin explicar nada. En ambos casos se cae a la
última página con datos.

**Un borrado que falla no siempre se cuenta igual.** El de alumnos deja el mensaje al
aviso global, porque no hay una causa concreta que anticipar. El de maestros sí la tiene:
`materias.maestro_id` no admite nulos, así que eliminar a quien imparte algo devuelve un
**409** con la frase genérica de la API ("la operación viola una restricción de datos"),
que es exacta y no le sirve a nadie — y no es el caso raro, es el de cualquier maestro con
clases. `features/maestros/detalle-maestro/` la traduce a la única causa posible ("tiene
materias a su cargo, asígnalas a otro maestro o elimínalas primero") y la deja **dentro de
la tarjeta**, junto al botón: un mensaje que explica qué hacer y se desvanece a los ocho
segundos no sirve de mucho. Por eso su `eliminar()` va con `sinAvisoGlobal()` y el de
alumnos no.

El de materias es el mismo caso con una diferencia: `calificaciones.materia_id` y
`asistencias.materia_id` tampoco admiten nulos, así que el 409 tiene **dos** causas
posibles y desde el frontend no se distinguen. El mensaje las nombra a las dos ("tiene
calificaciones o asistencias registradas") en vez de adivinar una, que sería mandar al
usuario a buscar donde quizá no hay nada. Alumnos sigue teniendo la misma trampa latente
—esas dos tablas apuntan también al alumno—, pero todavía no hay pantallas que creen esas
filas; cuando lleguen (Días 20–24) se verá si conviene generalizarlo.

La confirmación de una materia nombra **a su maestro** donde la de un alumno nombra la
matrícula: es lo que distingue dos "Álgebra" en una lista, porque una materia no tiene
ningún identificador humano propio.

## Calificaciones

`GET /api/calificaciones/alumno/{id}` y `/materia/{id}` **no vienen paginados**: devuelven
un arreglo, porque son las notas de un alumno o de una materia y no un catálogo. Por eso
estas pantallas no usan `listadoPaginado` — es la primera vez que un dominio no lo hace, y
no es una decisión del frontend.

**Registrar es un *upsert*.** El `POST` inserta o actualiza según ya exista una calificación
para el mismo alumno, materia y periodo, y responde **201 en los dos casos**: por el código
de estado no se puede distinguir un alta de un reemplazo. No hay `PUT` ni `DELETE` —
corregir una nota es volver a registrarla.

Eso deja un riesgo que la API no cubre: sustituir un 5.8 por un 9 sin que nadie se entere.
`features/calificaciones/formulario-calificacion/` lo comprueba antes de guardar (pide las
notas de esa materia) y **pregunta**, nombrando las dos cifras. Si la comprobación falla,
guarda igual: avisar es una cortesía y no poder avisar no es motivo para descartar lo que
el usuario pidió.

Otras tres decisiones de esa pantalla:

- **Registrar no es `ROLES_ESCRITURA`.** La API abre este `POST` también al MAESTRO, que es
  quien pone las notas (`ROLES_REGISTRO` en `core/navegacion.ts`). Lo que sigue exigiendo es
  que la materia sea **suya**, y eso no lo puede decidir una lista de roles: lo valida el
  servidor materia a materia. El desplegable se acota con `?maestroId=` —el filtro del Día
  18— después de preguntar `GET /api/maestros/me` quién ha entrado, pero el 403 sigue
  siendo posible: la materia puede cambiar de maestro entre que se carga la lista y se
  pulsa guardar, así que también se maneja.
- **Dos decimales como mucho.** La columna es `precision = 4, scale = 2` y ninguna
  validación de la API lo cubre: un 9.567 se guardaría como 9.57 **en silencio**.
- **El desplegable de alumnos dice cuántos no enseña.** La API recorta en cien y una escuela
  puede pasar de ahí de sobra; dejar la lista como si estuviera completa sería mentir. El
  buscador que consulte al escribir necesita un endpoint que hoy no existe.

Al guardar, la materia y el periodo **se quedan puestos**: quien califica lo hace de varias
personas seguidas.

### Consultar por alumno

`/calificaciones` es la primera pantalla de consulta que **no es un listado paginado**: la
API devuelve el arreglo entero de notas de una persona, así que no hay paginador, ni `sort`
que mandar, ni `listadoPaginado` que reutilizar.

También es la primera que cambia **a quién consulta** según quién mire, y no sólo qué
botones enseña:

| Quién entra | Qué ve |
|---|---|
| ADMIN · MAESTRO | Un desplegable de alumnos; el elegido vive en la URL (`?alumnoId=3`) |
| ALUMNO | Lo suyo, resuelto con `GET /api/alumnos/me`, sin desplegable |

Para un ALUMNO el `?alumnoId=` de otro **se ignora a propósito**: pedirlo sólo conseguiría un
403, así que la pantalla no lo intenta. Y no pide el listado de alumnos, que tiene cerrado.

**Aquí sí se ordena en el cliente**, que fue justo el error del Día 18, y es correcto por la
misma razón por la que allí no lo era: entonces la pantalla tenía en memoria una página de
veinte filas de un total mayor, y ahora tiene el arreglo completo — no hay paginador que
descuadrar ni `sort` que la API sepa interpretar. Por periodo descendente y, dentro de cada
periodo, por materia.

El **promedio** lo calcula la pantalla: la API no expone ninguno y no se guarda en ningún
sitio. Lo que **no** se hace es marcar notas como aprobadas o reprobadas — la API no define
cuál es la mínima, y ponerla aquí sería inventar una regla de negocio que nadie ha escrito.

### Consultar por materia, y corregir

`/calificaciones/materia` es la otra mitad: la pantalla anterior mira a una persona en
todas sus materias, esta mira una materia con todo su grupo. La materia elegida vive en la
URL (`?materiaId=3`) y la ficha de la materia enlaza aquí.

Quién puede abrirla es una lista aparte (`ROLES_NOTAS_DE_MATERIA`) que **hoy coincide con
`ROLES_REGISTRO` y no significa lo mismo**: una dice quién escribe, la otra quién puede ver
de una sentada las notas de un grupo entero. El ALUMNO consulta las suyas y no las de sus
compañeros, así que no entra — aunque la sección de calificaciones sí sea suya.

Un MAESTRO ve **todas** las materias en el desplegable, no sólo las que imparte: leer las
notas de una materia no exige ser su maestro (la API no lo pide, a diferencia de
registrarlas), y la pantalla no se inventa una restricción que el servidor no tiene.

**Editar es volver a registrar.** La API no tiene `PUT` ni `DELETE` de calificaciones, así
que la columna de acciones no lleva a otro formulario: lleva al de registro con los datos en
la URL (`?alumnoId=1&materiaId=3&periodo=2026-1&calificacion=9.5`), que abre relleno y
titulado "Corregir calificación". El aviso de "vas a reemplazar" sigue saliendo, porque es
literalmente lo que va a pasar, y al guardar se vuelve a la tabla de la materia en vez de
quedarse para encadenar altas.

Lo que llega en esos parámetros **se valida** como el `sort` y los filtros de los listados:
son texto que cualquiera edita en la barra de direcciones, y un `?calificacion=veinte` o un
periodo con otro formato dejarían el formulario inválido desde el principio sin que se
entienda por qué. Y "corregir" es sólo lo que la pantalla sabe —que el usuario viene de una
nota que existe—, no algo que la API distinga: su `POST` y su 201 son los mismos.

## Asistencia

`/asistencia/registrar` es la primera pantalla que **escribe varios registros de una vez**, y
la API no sabe recibirlos juntos: `POST /api/asistencia` guarda a un alumno, así que una
lista de treinta son treinta peticiones. De ahí las tres decisiones que la definen:

- **Sólo se manda lo que cambió.** Reenviar la clase entera para corregir una falta es
  gratis para quien mira la pantalla y no para el servidor. Lo ya registrado se pide con
  `GET /api/asistencia/materia/{id}?fecha=` —el endpoint que faltaba— y lo que se ve empieza
  siendo eso.
- **Un fallo no cancela los demás.** Cada petición lleva su propio `catchError`: con un
  `forkJoin` a secas, un 403 tiraría abajo la clase completa. Al terminar se dice **a quién
  hay que repetirle**, por su nombre y no con un contador, y se recarga para que la pantalla
  vuelva a contar la verdad del servidor.
- **Tres estados por alumno, no dos**: presente, ausente y **sin marcar**. Un interruptor de
  dos posiciones confundiría "todavía no he pasado lista" con "faltó", que es justo lo que no
  se quiere apuntar por descuido.

La materia y el día viven en la URL, como todo lo demás. **Sin fecha no se supone hoy**:
pasar lista es apuntar algo que ocurrió un día concreto, y elegirlo por el usuario es la
clase de ayuda que acaba guardando faltas en el día equivocado. El calendario tiene `max` en
hoy porque la API rechaza las futuras (`@PastOrPresent`).

> **La fecha se compone a mano, no con `toISOString()`.** Ese método da la fecha en UTC, así
> que a partir de media tarde en un huso negativo devuelve el día siguiente: pasar lista un
> lunes por la noche la guardaría como del martes y la API la rechazaría por futura. Por lo
> mismo, `fecha` es una **cadena** en los modelos y no un `Date`.

A quién se pasa lista es **todos los alumnos**: el esquema no tiene inscripciones, ninguna
tabla dice quién cursa qué. Es una limitación del modelo, no de la pantalla, y por eso el
aviso de "faltan N" pesa aquí más que en cualquier otro desplegable. Un MAESTRO sí ve
acotadas sus materias, a diferencia de la consulta del Día 22: esta pantalla escribe, y la
API rechaza con un 403 la materia que no imparte.

## Errores y avisos

`errorInterceptor` (`core/interceptors/`) es la red de seguridad, y hace dos cosas que
conviene no mezclar:

| Caso | Qué pasa |
|---|---|
| 401 con sesión abierta | El token venció: se cierra la sesión y se va al login con `?returnUrl=` |
| 401 en `/auth/login` | Nada — ahí significa "credenciales incorrectas" y lo explica el formulario |
| Cualquier otro error | Aviso flotante con el mensaje de la API |

Las peticiones cuyo error **pinta la propia pantalla** se marcan con `sinAvisoGlobal()`:
el listado y la ficha tienen su aviso con botón de reintentar, y el formulario coloca el
error en el campo que lo provocó. Sin eso el usuario vería el mismo fallo dos veces. El
borrado es la excepción a propósito — no tiene dónde enseñarlo, así que lo cuenta el
interceptor. El valor de que el aviso sea el comportamiento **por defecto** está en las
acciones que vengan después: una que nadie se acuerde de manejar avisa igual en vez de
fallar en silencio.

Los avisos salen por `Avisos` (`core/services/avisos.ts`), que importa `MatSnackBar`
**dinámicamente**. Al servicio lo alcanza el interceptor, que se registra en
`app.config.ts`, así que un `import` normal mete el aviso y el overlay del CDK en el
grafo inicial: son 158 kB extra en la primera carga, la del login, que no enseña
ninguno.

> Ojo con medir eso: el presupuesto de 500 kB **no** lo detectó. esbuild movió el código
> compartido a un chunk que marca como *lazy* pero que `main` importa de forma estática,
> de modo que el "Initial total" que informa `ng build` bajó mientras la descarga real
> crecía. Lo que hay que mirar es el cierre estático de `main`, no ese número.

## Decisiones

- **Standalone y zoneless.** El scaffold no usa NgModules ni `zone.js`; la detección de
  cambios va por signals, que es el camino soportado desde Angular 20.
- **Vitest en vez de Karma.** Karma está deprecado y Angular 22 genera el proyecto con
  Vitest; el API de `TestBed` es el mismo.
- **Material 3 con el tema azure/blue** vía `mat.theme()`, que define variables CSS
  (`--mat-sys-*`) — eso deja el tema oscuro del Día 34 como un cambio de `color-scheme`.
- **Lo repetido se extrae al segundo caso, no al primero.** El listado de alumnos se
  escribió entero en su pantalla; al llegar el de maestros quedó claro qué era del
  dominio y qué no, y sólo entonces se sacó a `shared/listado-paginado.ts`. Adivinarlo
  con un solo caso delante suele producir la abstracción equivocada.

## Usuarios de prueba

Los que siembra la API (ver su README):

| Email | Contraseña | Rol |
|---|---|---|
| `admin@escuela.com` | `admin123` | ADMIN |
| `juan.perez@escuela.com` | `maestro123` | MAESTRO |
| `ana.lopez@escuela.com` | `alumno123` | ALUMNO |
