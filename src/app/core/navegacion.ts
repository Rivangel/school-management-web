import { Rol } from './models';

/** Una entrada del menú lateral. */
export interface ElementoMenu {
  readonly ruta: string;
  readonly etiqueta: string;
  /** Nombre del icono de Material Symbols. */
  readonly icono: string;
  /** Roles que pueden ver la entrada. Espeja lo que autoriza la API. */
  readonly roles: readonly Rol[];
}

const TODOS: readonly Rol[] = ['ADMIN', 'MAESTRO', 'ALUMNO'];

/**
 * Secciones de la aplicación, en el orden en que aparecen en el menú.
 *
 * Los roles son un **espejo de `SecurityConfig`** de la API, no una regla nueva:
 * si aquí se abre una sección que allá está cerrada, el usuario llega a una
 * pantalla que sólo sabe enseñar un 403. Ocultar no es proteger — la decisión
 * real la sigue tomando la API.
 */
export const MENU: readonly ElementoMenu[] = [
  { ruta: '/', etiqueta: 'Inicio', icono: 'dashboard', roles: TODOS },
  { ruta: '/alumnos', etiqueta: 'Alumnos', icono: 'groups', roles: ['ADMIN', 'MAESTRO'] },
  { ruta: '/maestros', etiqueta: 'Maestros', icono: 'school', roles: ['ADMIN', 'MAESTRO'] },
  { ruta: '/materias', etiqueta: 'Materias', icono: 'menu_book', roles: TODOS },
  { ruta: '/calificaciones', etiqueta: 'Calificaciones', icono: 'grade', roles: TODOS },
  { ruta: '/asistencia', etiqueta: 'Asistencia', icono: 'event_available', roles: TODOS },
  { ruta: '/reportes', etiqueta: 'Reportes', icono: 'description', roles: TODOS },
];

/**
 * Quién puede crear, editar y borrar en las secciones de gestión.
 *
 * Espeja `SecurityConfig`: la API abre el `GET` de alumnos, maestros y materias
 * al MAESTRO, pero reserva las escrituras al ADMIN. Vive aquí, junto a `MENU`,
 * por la misma razón que los roles de las secciones — el botón que ofrece la
 * acción y el guard que protege la ruta tienen que leer lo mismo, o el usuario
 * acaba pulsando un "Nuevo alumno" que lo lleva a "acceso denegado".
 */
export const ROLES_ESCRITURA: readonly Rol[] = ['ADMIN'];

/**
 * Quién registra calificaciones y asistencia.
 *
 * **No es `ROLES_ESCRITURA`**, y esa es la diferencia que importa: en alumnos,
 * maestros y materias escribir es del ADMIN, pero aquí la API abre el `POST` al
 * MAESTRO — que es justamente quien pone las notas y pasa lista. Lo que la API
 * sigue exigiendo es que la materia sea suya, y eso no se puede comprobar con
 * una lista de roles: lo valida el servidor materia a materia.
 */
export const ROLES_REGISTRO: readonly Rol[] = ['ADMIN', 'MAESTRO'];

/**
 * Quién puede ver las notas de **una materia entera**.
 *
 * Coincide hoy con `ROLES_REGISTRO` y no significa lo mismo: aquella dice quién
 * escribe, esta quién puede ver de una sentada las calificaciones de todo un
 * grupo. Un ALUMNO consulta las suyas y no las de sus compañeros, así que esta
 * lista no lo incluye aunque la sección de calificaciones sí lo haga.
 *
 * Son dos constantes y no una porque el día que una cambie —una escuela que
 * deje al alumno ver la media de su grupo, pongamos— la otra no tiene por qué.
 */
export const ROLES_NOTAS_DE_MATERIA: readonly Rol[] = ['ADMIN', 'MAESTRO'];

/** Entradas visibles para un rol. Sin sesión no se enseña ninguna. */
export function menuPara(rol: Rol | null): readonly ElementoMenu[] {
  return rol === null ? [] : MENU.filter((elemento) => elemento.roles.includes(rol));
}

/**
 * Roles de una sección, para que las rutas los tomen de aquí en vez de repetirlos.
 *
 * Es lo que evita la avería silenciosa: si el menú y el `rolGuard` de la ruta se
 * escriben por separado, el día que cambie uno el otro se queda atrás y la
 * entrada aparece en el menú para llevar a un "acceso denegado".
 *
 * Falla ruidosamente ante una ruta desconocida: pasa al cargar la configuración
 * del router, así que un error de dedo se ve al arrancar y no cuando alguien
 * pulse el enlace.
 */
export function rolesDe(ruta: string): Rol[] {
  const elemento = MENU.find((candidato) => candidato.ruta === ruta);
  if (elemento === undefined) {
    throw new Error(`La ruta "${ruta}" no está en el menú: agrégala a MENU.`);
  }
  return [...elemento.roles];
}
