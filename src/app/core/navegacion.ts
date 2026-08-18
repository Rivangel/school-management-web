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
