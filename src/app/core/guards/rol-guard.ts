import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Rol } from '../models';
import { AuthService } from '../services/auth-service';
import { urlDeLogin } from './auth-guard';

/**
 * Fábrica de guards por rol: `canActivate: [rolGuard('ADMIN', 'MAESTRO')]`.
 *
 * Es una fábrica y no un guard suelto porque cada ruta admite una lista distinta
 * de roles y `CanActivateFn` no recibe parámetros propios. La alternativa
 * (leerlos de `route.data`) obliga a repetir la clave en cada ruta y el
 * compilador no comprueba lo que se escribe ahí.
 *
 * Distingue dos negativas que no son lo mismo: sin sesión se va al login (falta
 * identificarse), y con sesión pero sin el rol se va a "acceso denegado" —
 * mandar al login a alguien que ya inició sesión sólo consigue que vuelva a
 * entrar y choque contra la misma pared.
 */
export function rolGuard(...roles: Rol[]): CanActivateFn {
  return (_ruta, estado) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.estaAutenticado()) {
      return urlDeLogin(router, estado.url);
    }

    return auth.tieneAlgunRol(...roles) || router.createUrlTree(['/acceso-denegado']);
  };
}
