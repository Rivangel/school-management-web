import { Rol, esRol } from '../models';

/** Claims que emite `JwtUtil` de la API: el email en `sub` y el rol en `rol`. */
export interface ClaimsJwt {
  sub?: string;
  rol?: Rol;
  /** Expiración en segundos desde el epoch (así lo define el estándar, no en ms). */
  exp?: number;
}

/**
 * Lee la carga útil de un JWT **sin verificar la firma**.
 *
 * Verificarla en el navegador no tendría sentido: el secreto vive en la API y
 * es ella quien rechaza un token manipulado con un 401. Aquí sólo se leen los
 * claims para dos cosas honestas: saber si el token ya expiró y de qué rol
 * habla. Ninguna decisión de seguridad real depende de esto.
 */
export function leerClaims(token: string): ClaimsJwt | null {
  const partes = token.split('.');
  if (partes.length !== 3) {
    return null;
  }

  try {
    const carga: unknown = JSON.parse(decodificarBase64Url(partes[1]));
    if (carga === null || typeof carga !== 'object') {
      return null;
    }

    const { sub, rol, exp } = carga as Record<string, unknown>;
    return {
      sub: typeof sub === 'string' ? sub : undefined,
      rol: esRol(rol) ? rol : undefined,
      exp: typeof exp === 'number' ? exp : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Indica si el token ya no sirve.
 *
 * Un token ilegible cuenta como expirado: si no se puede leer, tampoco se puede
 * afirmar que siga vigente.
 */
export function estaExpirado(token: string, ahoraMs: number = Date.now()): boolean {
  const exp = leerClaims(token)?.exp;
  return exp === undefined || exp * 1000 <= ahoraMs;
}

/**
 * Decodifica un segmento base64url a texto.
 *
 * `atob` sólo entiende base64 clásico y devuelve bytes, no caracteres: hay que
 * traducir el alfabeto url-safe, reponer el relleno y pasar los bytes por
 * `TextDecoder` para que un nombre con acentos no salga roto.
 */
function decodificarBase64Url(segmento: string): string {
  const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const bytes = Uint8Array.from(atob(relleno), (caracter) => caracter.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
