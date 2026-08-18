import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { Avisos } from '../services/avisos';
import { AuthService } from '../services/auth-service';
import { mensajeDeError } from '../services/mensaje-error';

/** Endpoints donde un 401 significa "credenciales malas", no "sesión caducada". */
const RUTAS_DE_AUTENTICACION = ['/auth/login', '/auth/register'];

const SIN_AVISO = new HttpContextToken(() => false);

/**
 * Marca una petición cuyo error pinta la propia pantalla.
 *
 * Se usa en las lecturas que tienen su aviso con botón de reintentar y en los
 * envíos de formulario, que colocan el error en el campo que lo provocó. Sin
 * esto el usuario vería el mismo fallo dos veces: en su sitio y como aviso
 * flotante.
 */
export function sinAvisoGlobal(contexto: HttpContext = new HttpContext()): HttpContext {
  return contexto.set(SIN_AVISO, true);
}

/**
 * Red de seguridad para los errores de la API.
 *
 * Hace dos cosas distintas:
 *
 * 1. **Un 401 con sesión abierta es una sesión caducada.** El token venció o
 *    dejó de valer, así que se cierra la sesión y se manda al login guardando la
 *    ruta actual en `returnUrl`. Sin esto el usuario se queda mirando una
 *    pantalla que no carga, sin saber que tiene que volver a entrar.
 * 2. **Todo lo demás sale como aviso flotante**, salvo que la petición se haya
 *    marcado con `sinAvisoGlobal()`. El valor está en el "salvo": una acción que
 *    nadie se acordó de manejar avisa igual, en vez de fallar en silencio.
 *
 * El error se vuelve a lanzar siempre: avisar no es manejarlo, y quien pidió
 * sigue necesitando enterarse.
 */
export const errorInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const auth = inject(AuthService);
  const avisos = inject(Avisos);
  const router = inject(Router);

  return siguiente(peticion).pipe(
    catchError((fallo: unknown) => {
      const estado = fallo instanceof HttpErrorResponse ? fallo.status : 0;

      if (estado === 401 && !esAutenticacion(peticion.url)) {
        // Con la sesión ya cerrada, este 401 es otra de las peticiones que iban
        // en vuelo: el aviso y la redirección salieron con la primera.
        if (auth.estaAutenticado()) {
          auth.logout();
          avisos.error('Tu sesión caducó. Vuelve a iniciar sesión.');
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
        return throwError(() => fallo);
      }

      if (!peticion.context.get(SIN_AVISO)) {
        avisos.error(mensajeDeError(fallo));
      }
      return throwError(() => fallo);
    }),
  );
};

function esAutenticacion(url: string): boolean {
  return RUTAS_DE_AUTENTICACION.some((ruta) => url.includes(ruta));
}
