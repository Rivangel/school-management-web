import { Rol, Sesion } from '../../models';
import { tokenFalso } from './token-falso';

/** Misma clave que usa `AuthService` para persistir la sesión. */
export const CLAVE_SESION = 'school-management.sesion';

/** Sesión con la forma que guarda `AuthService` tras un login correcto. */
export function sesionFalsa(rol: Rol = 'ADMIN', expiraEnSegundos = 3600): Sesion {
  const email = `${rol.toLowerCase()}@escuela.com`;
  return {
    token: tokenFalso({ sub: email, rol }, expiraEnSegundos),
    email,
    nombre: `Usuario ${rol}`,
    rol,
  };
}

/**
 * Deja una sesión en `localStorage` **antes** de instanciar `AuthService`.
 *
 * El servicio lee el almacenamiento una sola vez, al construirse, así que este
 * orden importa: sembrar después no cambia nada.
 */
export function sembrarSesion(rol: Rol = 'ADMIN', expiraEnSegundos = 3600): Sesion {
  const sesion = sesionFalsa(rol, expiraEnSegundos);
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  return sesion;
}
