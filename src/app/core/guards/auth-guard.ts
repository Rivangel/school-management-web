import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth-service';

/**
 * Deja pasar sólo si hay sesión; si no, manda al login.
 *
 * Ojo: esto no es seguridad, es navegación. `AuthService` sólo mira el token que
 * hay en `localStorage`; quien manda de verdad es la API, que responde 401/403
 * aunque el guard haya dejado pasar.
 */
export const authGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.estaAutenticado() || urlDeLogin(router, estado.url);
};

/**
 * Construye la redirección al login recordando a dónde quería ir el usuario.
 *
 * El `returnUrl` es lo que permite volver a la ruta pedida tras iniciar sesión:
 * sin él, quien abre un enlace directo a una ficha acaba siempre en la portada y
 * tiene que buscarla otra vez. La portada se omite a propósito — es justo el
 * destino por defecto del login, así que sólo ensuciaría la barra de direcciones.
 */
export function urlDeLogin(router: Router, url: string): UrlTree {
  const returnUrl = url === '/' ? undefined : url;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
}
