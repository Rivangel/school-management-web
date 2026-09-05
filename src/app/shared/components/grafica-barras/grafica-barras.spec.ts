import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Barra } from '../../../core/estadisticas';
import { GraficaBarras } from './grafica-barras';

@Component({
  imports: [GraficaBarras],
  template: `
    <app-grafica-barras
      [barras]="barras()"
      [titulo]="'Promedio por materia'"
      [unidad]="'Promedio'"
      [maximo]="maximo()"
      [vacio]="'Sin notas registradas.'"
    />
  `,
})
class Anfitrion {
  readonly barras = signal<Barra[]>([]);
  readonly maximo = signal<number | null>(null);
}

describe('GraficaBarras', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;

  const anchos = (): number[] =>
    [...fixture.nativeElement.querySelectorAll('.grafica__barra')].map((barra: Element) =>
      Number(barra.getAttribute('width')),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
  });

  it('sin datos enseña el mensaje de vacío y ninguna barra', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sin notas registradas.');
    expect(anchos()).toEqual([]);
  });

  it('dibuja una barra por dato, con su etiqueta y su texto', () => {
    anfitrion.barras.set([
      { etiqueta: 'Álgebra', valor: 8, texto: '8.00' },
      { etiqueta: 'Química', valor: 6, texto: '6.00' },
    ]);
    fixture.detectChanges();

    expect(anchos()).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Álgebra');
    expect(fixture.nativeElement.textContent).toContain('8.00');
  });

  it('sin máximo declarado, el valor más alto llena la pista', () => {
    anfitrion.barras.set([
      { etiqueta: 'Álgebra', valor: 8, texto: '8' },
      { etiqueta: 'Química', valor: 4, texto: '4' },
    ]);
    fixture.detectChanges();

    expect(anchos()).toEqual([100, 50]);
  });

  it('con máximo declarado la escala es esa: un 6 sobre 10 no llena la barra', () => {
    anfitrion.barras.set([{ etiqueta: 'Álgebra', valor: 6, texto: '6.00' }]);
    anfitrion.maximo.set(10);
    fixture.detectChanges();

    expect(anchos()).toEqual([60]);
  });

  it('un valor de cero deja un hilo visible, para que no parezca un fallo de carga', () => {
    anfitrion.barras.set([
      { etiqueta: 'Álgebra', valor: 0, texto: '0' },
      { etiqueta: 'Química', valor: 10, texto: '10' },
    ]);
    fixture.detectChanges();

    const [cero] = anchos();
    expect(cero).toBeGreaterThan(0);
    expect(cero).toBeLessThan(1);
  });

  it('el dibujo se oculta al lector de pantalla y la tabla equivalente no', () => {
    anfitrion.barras.set([{ etiqueta: 'Álgebra', valor: 8, texto: '8.00' }]);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('.grafica__pista');
    expect(svg.getAttribute('aria-hidden')).toBe('true');

    const tabla = fixture.nativeElement.querySelector('table.solo-lectores');
    expect(tabla.hasAttribute('aria-hidden')).toBe(false);
    expect(tabla.textContent).toContain('Álgebra');
    expect(tabla.textContent).toContain('8.00');
  });

  it('la tabla accesible nombra la unidad de la serie', () => {
    anfitrion.barras.set([{ etiqueta: 'Álgebra', valor: 8, texto: '8.00' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('table.solo-lectores thead').textContent).toContain(
      'Promedio',
    );
  });
});
