import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { IdDeRuta, idDeRuta } from './id-de-ruta';

@Component({ template: '' })
class Pantalla {
  readonly enLaRuta: IdDeRuta = idDeRuta();
}

describe('idDeRuta', () => {
  let harness: RouterTestingHarness;

  async function abrir(url: string): Promise<IdDeRuta> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'alumnos/nuevo', component: Pantalla },
          { path: 'alumnos/:id', component: Pantalla },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create(url);
    return harness.routeDebugElement!.componentInstance.enLaRuta as IdDeRuta;
  }

  it('sin segmento no hay id que interpretar', async () => {
    const enLaRuta = await abrir('/alumnos/nuevo');

    expect(enLaRuta.id()).toBeUndefined();
    expect(enLaRuta.presente()).toBe(false);
    expect(enLaRuta.invalido()).toBe(false);
  });

  it('un número es el id del registro', async () => {
    const enLaRuta = await abrir('/alumnos/7');

    expect(enLaRuta.id()).toBe(7);
    expect(enLaRuta.presente()).toBe(true);
    expect(enLaRuta.invalido()).toBe(false);
  });

  it('lo que no es un número se distingue de no traer nada', async () => {
    // La diferencia es la que evita que `/alumnos/abc/editar` se comporte como
    // un alta y el primer guardado cree un registro que nadie pidió.
    const enLaRuta = await abrir('/alumnos/abc');

    expect(enLaRuta.id()).toBeUndefined();
    expect(enLaRuta.presente()).toBe(true);
    expect(enLaRuta.invalido()).toBe(true);
  });

  it('sigue al id cuando el router reutiliza el componente', async () => {
    // Dos rutas que sólo se distinguen por el id comparten componente: leyendo
    // del `snapshot`, la pantalla se quedaría enseñando al registro anterior.
    const enLaRuta = await abrir('/alumnos/7');

    await TestBed.inject(Router).navigateByUrl('/alumnos/9');
    harness.detectChanges();

    expect(enLaRuta.id()).toBe(9);
  });
});
