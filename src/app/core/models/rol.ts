/** Espejo de `com.escuela.model.entity.Rol`. */
export type Rol = 'ADMIN' | 'MAESTRO' | 'ALUMNO';

export const ROLES: readonly Rol[] = ['ADMIN', 'MAESTRO', 'ALUMNO'] as const;

/**
 * Comprueba que un valor cualquiera sea un rol conocido.
 *
 * Hace falta porque el rol llega de fuera (del cuerpo del login y de los claims
 * del JWT), y un valor desconocido debe tratarse como sesión inválida en vez de
 * colarse hasta el menú y decidir qué ve el usuario.
 */
export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}
