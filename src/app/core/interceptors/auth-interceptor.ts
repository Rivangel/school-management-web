import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth-service';

/** Endpoints que la API deja públicos y que no deben recibir el token. */
const RUTAS_PUBLICAS = ['/auth/login', '/auth/register'];

/**
 * Añade `Authorization: Bearer <token>` a las peticiones a nuestra API.
 *
 * El filtro por URL es el punto importante: el token sólo se adjunta si la
 * petición va a `environment.apiUrl`. Sin esa comprobación, cualquier `HttpClient`
 * que pidiera un recurso de otro host (una fuente, un CDN, un mapa) se llevaría
 * la credencial del usuario en la cabecera.
 *
 * Login y registro se excluyen porque no lo necesitan y mandar un token viejo
 * ahí sólo añade ruido a los logs de la API.
 */
export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const token = inject(AuthService).token();

  if (token === null || !vaALaApi(peticion.url) || esRutaPublica(peticion.url)) {
    return siguiente(peticion);
  }

  return siguiente(peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

function vaALaApi(url: string): boolean {
  return url.startsWith(environment.apiUrl);
}

function esRutaPublica(url: string): boolean {
  return RUTAS_PUBLICAS.some((ruta) => url.includes(ruta));
}
