/**
 * Configuración de producción (es la que usa `ng build` por defecto).
 *
 * `apiUrl` es relativa a propósito: en producción el frontend se sirve detrás de
 * nginx junto a la API (ver Día 36 del plan), así que el navegador pega al mismo
 * origen y no hay que tocar CORS ni recompilar para cambiar de host.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
};
