import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ReportePdf, ReporteService } from './reporte-service';

const URL = `${environment.apiUrl}/reportes`;

describe('ReporteService', () => {
  let http: HttpTestingController;
  let servicio: ReporteService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(ReporteService);
  });

  afterEach(() => {
    http.verify();
  });

  it('pide la boleta como Blob y lee el nombre de Content-Disposition', () => {
    let recibido: ReportePdf | undefined;
    servicio.obtenerBoleta(5).subscribe((res) => (recibido = res));

    const peticion = http.expectOne(`${URL}/boleta/5`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.responseType).toBe('blob');

    const contenidoBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    peticion.flush(contenidoBlob, {
      headers: {
        'Content-Disposition': 'attachment; filename="boleta-A999.pdf"',
      },
    });

    expect(recibido?.nombreArchivo).toBe('boleta-A999.pdf');
    expect(recibido?.blob).toBeTruthy();
  });

  it('usa un nombre por defecto si no viene Content-Disposition', () => {
    let recibido: ReportePdf | undefined;
    servicio.obtenerBoleta(12).subscribe((res) => (recibido = res));

    const peticion = http.expectOne(`${URL}/boleta/12`);
    const contenidoBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    peticion.flush(contenidoBlob);

    expect(recibido?.nombreArchivo).toBe('boleta-12.pdf');
  });
});
