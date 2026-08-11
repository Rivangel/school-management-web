import { estaExpirado, leerClaims } from './jwt';
import { tokenFalso } from './testing/token-falso';

describe('jwt', () => {
  it('lee el email y el rol de los claims', () => {
    const claims = leerClaims(tokenFalso({ sub: 'juan.perez@escuela.com', rol: 'MAESTRO' }));

    expect(claims?.sub).toBe('juan.perez@escuela.com');
    expect(claims?.rol).toBe('MAESTRO');
  });

  it('sobrevive a caracteres no ASCII en los claims', () => {
    const claims = leerClaims(tokenFalso({ sub: 'ana.lópez@escuela.com', rol: 'ALUMNO' }));

    expect(claims?.sub).toBe('ana.lópez@escuela.com');
  });

  it('ignora un rol que no existe en la API', () => {
    const token = tokenFalso({ sub: 'x@escuela.com', rol: 'SUPERADMIN' as never });

    expect(leerClaims(token)?.rol).toBeUndefined();
  });

  it('devuelve null si el token no tiene tres partes o no es base64', () => {
    expect(leerClaims('esto-no-es-un-jwt')).toBeNull();
    expect(leerClaims('a.b.c')).toBeNull();
  });

  it('distingue un token vigente de uno caducado', () => {
    expect(estaExpirado(tokenFalso({ sub: 'x@escuela.com', rol: 'ADMIN' }, 3600))).toBe(false);
    expect(estaExpirado(tokenFalso({ sub: 'x@escuela.com', rol: 'ADMIN' }, -1))).toBe(true);
  });

  it('trata un token ilegible como caducado', () => {
    expect(estaExpirado('esto-no-es-un-jwt')).toBe(true);
  });
});
