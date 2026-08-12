import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { Rol } from '../models';
import { sembrarSesion } from '../services/testing/sesion-falsa';
import { rolGuard } from './rol-guard';

describe('rolGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  function ejecutar(roles: Rol[], url = '/alumnos'): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    return TestBed.runInInjectionContext(() =>
      rolGuard(...roles)({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  function comoUrl(resultado: boolean | UrlTree): string {
    return TestBed.inject(Router).serializeUrl(resultado as UrlTree);
  }

  it('deja pasar cuando el rol está en la lista', () => {
    sembrarSesion('MAESTRO');

    expect(ejecutar(['ADMIN', 'MAESTRO'])).toBe(true);
  });

  it('manda a acceso denegado cuando hay sesión pero el rol no basta', () => {
    sembrarSesion('ALUMNO');

    const resultado = ejecutar(['ADMIN']);

    expect(comoUrl(resultado)).toBe('/acceso-denegado');
  });

  it('manda al login, no a acceso denegado, cuando no hay sesión', () => {
    const resultado = ejecutar(['ADMIN']);

    expect(comoUrl(resultado)).toBe('/login?returnUrl=%2Falumnos');
  });

  it('no deja pasar a nadie si la lista de roles va vacía', () => {
    sembrarSesion('ADMIN');

    expect(comoUrl(ejecutar([]))).toBe('/acceso-denegado');
  });
});
