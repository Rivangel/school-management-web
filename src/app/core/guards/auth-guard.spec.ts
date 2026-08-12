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
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  function ejecutar(url: string): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  function comoUrl(resultado: boolean | UrlTree): string {
    return TestBed.inject(Router).serializeUrl(resultado as UrlTree);
  }

  it('deja pasar cuando hay sesión', () => {
    sembrarSesion('ADMIN');

    expect(ejecutar('/alumnos')).toBe(true);
  });

  it('manda al login cuando no hay sesión', () => {
    const resultado = ejecutar('/alumnos');

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(comoUrl(resultado)).toBe('/login?returnUrl=%2Falumnos');
  });

  it('conserva los parámetros de la ruta pedida en el returnUrl', () => {
    const resultado = ejecutar('/alumnos/7?tab=notas');

    expect(comoUrl(resultado)).toBe('/login?returnUrl=%2Falumnos%2F7%3Ftab%3Dnotas');
  });

  it('no arrastra un returnUrl cuando la ruta pedida era la portada', () => {
    const resultado = ejecutar('/');

    expect(comoUrl(resultado)).toBe('/login');
  });

  it('manda al login cuando el token guardado ya expiró', () => {
    sembrarSesion('ADMIN', -60);

    expect(ejecutar('/alumnos')).toBeInstanceOf(UrlTree);
  });
});
