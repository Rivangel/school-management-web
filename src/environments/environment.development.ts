/**
 * Configuración de desarrollo (`ng serve`).
 *
 * Apunta al puerto donde corre la API de Spring Boot. El origen es distinto al
 * del `ng serve` (4200), por eso la API declara `http://localhost:4200` en
 * `app.cors.allowed-origins`.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
};
