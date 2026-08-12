import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth-service';

/**
 * El reverso del `authGuard`: reserva el login para quien todavía no ha entrado.
 *
 * Sin él, el botón "atrás" del navegador devuelve al formulario de login estando
 * ya dentro, con la sesión viva y sin nada que hacer ahí.
 */
export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return !auth.estaAutenticado() || router.createUrlTree(['/']);
};
