import { Rol } from './rol';

/** Espejo de `LoginRequest`. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Espejo de `RegisterRequest`. La contraseña debe tener entre 6 y 60 caracteres. */
export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
}

/**
 * Espejo de `AuthResponse`.
 *
 * `tipo` siempre vale `Bearer`; el rol viene aquí ya resuelto, así que no hace
 * falta abrir el token para pintar el menú.
 */
export interface AuthResponse {
  token: string;
  tipo: string;
  email: string;
  nombre: string;
  rol: Rol;
}

/** Datos de la sesión que el frontend guarda entre recargas. */
export interface Sesion {
  token: string;
  email: string;
  nombre: string;
  rol: Rol;
}
