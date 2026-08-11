import { Rol } from '../../models';

/**
 * Arma un JWT con la forma que emite la API pero con la firma inventada.
 *
 * Basta para los tests del frontend: aquí nadie verifica la firma, sólo se leen
 * los claims. La expiración se pasa en segundos relativos a ahora, de modo que
 * un valor negativo produzca un token ya caducado.
 */
export function tokenFalso(claims: { sub: string; rol: Rol }, expiraEnSegundos = 3600): string {
  const cabecera = codificar({ alg: 'HS256', typ: 'JWT' });
  const carga = codificar({
    ...claims,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiraEnSegundos,
  });
  return `${cabecera}.${carga}.firma-inventada`;
}

function codificar(objeto: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(objeto));
  const binario = String.fromCharCode(...bytes);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
