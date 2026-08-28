import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AlumnoService } from '../../core/services/alumno-service';
import { AuthService } from '../../core/services/auth-service';
import { Avisos } from '../../core/services/avisos';
import { ReporteService } from '../../core/services/reporte-service';
import { Reportes } from './reportes';

describe('Reportes Component', () => {
  let component: Reportes;
  let fixture: ComponentFixture<Reportes>;
  let reporteService: ReporteService;
  let alumnoService: AlumnoService;
  let authService: AuthService;
  let avisos: Avisos;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reportes],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Reportes);
    component = fixture.componentInstance;
    reporteService = TestBed.inject(ReporteService);
    alumnoService = TestBed.inject(AlumnoService);
    authService = TestBed.inject(AuthService);
    avisos = TestBed.inject(Avisos);
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('llama a descargarBoleta en ReporteService', () => {
    const spy = vi.spyOn(reporteService, 'descargarBoleta').mockReturnValue(of('boleta-A100.pdf'));
    const spyAviso = vi.spyOn(avisos, 'exito').mockImplementation(() => {});

    component['descargarBoleta'](1);

    expect(spy).toHaveBeenCalledWith(1);
    expect(spyAviso).toHaveBeenCalledWith('Boleta descargada: boleta-A100.pdf');
  });

  it('muestra aviso de error si la descarga falla', () => {
    vi.spyOn(reporteService, 'descargarBoleta').mockReturnValue(
      throwError(() => new Error('Error al descargar')),
    );
    const spyAviso = vi.spyOn(avisos, 'error').mockImplementation(() => {});

    component['descargarBoleta'](1);

    expect(spyAviso).toHaveBeenCalled();
  });
});
