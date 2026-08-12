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

import { sembrarSesion } from '../services/testing/sesion-falsa';
import { invitadoGuard } from './invitado-guard';

describe('invitadoGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  function ejecutar(): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    return TestBed.runInInjectionContext(() =>
      invitadoGuard({} as ActivatedRouteSnapshot, { url: '/login' } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('deja ver el login cuando no hay sesión', () => {
    expect(ejecutar()).toBe(true);
  });

  it('devuelve a la portada a quien ya inició sesión', () => {
    sembrarSesion('ADMIN');

    const resultado = ejecutar();

    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/');
  });
});
