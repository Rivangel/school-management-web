import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { avisaGlobalmente } from '../interceptors/error-interceptor';
import { ReportePdf, ReporteService, descargarArchivo } from './reporte-service';

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

  it('acepta un filename sin comillas', () => {
    // La API las pone, pero la cabecera es del servidor y no de la aplicación:
    // detrás de nginx (Día 36) o de un proxy la puede reescribir otro.
    let recibido: ReportePdf | undefined;
    servicio.obtenerBoleta(3).subscribe((res) => (recibido = res));

    http.expectOne(`${URL}/boleta/3`).flush(new Blob(['%PDF-1.4']), {
      headers: { 'Content-Disposition': 'attachment; filename=boleta-A3.pdf' },
    });

    expect(recibido?.nombreArchivo).toBe('boleta-A3.pdf');
  });

  it('el fallo lo cuenta la pantalla, no el aviso global', () => {
    // Un ALUMNO pidiendo la boleta de otro recibe un 403, y la pantalla de
    // reportes ya lo explica junto al botón que se acaba de pulsar.
    servicio.obtenerBoleta(9).subscribe({ error: () => undefined });

    const peticion = http.expectOne(`${URL}/boleta/9`);
    expect(avisaGlobalmente(peticion.request.context)).toBe(false);
    peticion.flush(null, { status: 403, statusText: 'Forbidden' });
  });

  describe('la descarga', () => {
    let crear: ReturnType<typeof vi.spyOn>;
    let revocar: ReturnType<typeof vi.spyOn>;
    let pulsado: HTMLAnchorElement[];

    beforeEach(() => {
      // Los object URL de jsdom son de verdad, así que se espían sin sustituir:
      // lo que importa es que a cada uno que se crea le siga su revocación.
      // `globalThis` porque en este archivo `URL` es la constante de arriba.
      crear = vi.spyOn(globalThis.URL, 'createObjectURL');
      revocar = vi.spyOn(globalThis.URL, 'revokeObjectURL');
      // El clic sí se sustituye: uno de verdad haría a jsdom intentar navegar.
      pulsado = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        pulsado.push(this);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('descarga con el nombre que mandó el servidor y suelta el blob', () => {
      let nombre: string | undefined;
      servicio.descargarBoleta(4).subscribe((valor) => (nombre = valor));

      http.expectOne(`${URL}/boleta/4`).flush(new Blob(['%PDF-1.4']), {
        headers: { 'Content-Disposition': 'attachment; filename="boleta-A004.pdf"' },
      });

      const url = crear.mock.results[0].value as string;
      expect(nombre).toBe('boleta-A004.pdf');
      expect(pulsado).toHaveLength(1);
      expect(pulsado[0].download).toBe('boleta-A004.pdf');
      expect(pulsado[0].href).toBe(url);
      // Sin revocar, cada boleta descargada deja su PDF en memoria hasta que se
      // recargue la pestaña.
      expect(revocar).toHaveBeenCalledWith(url);
    });

    it('no deja el enlace colgando del documento', () => {
      // Hace falta insertarlo para que el clic cuente en Firefox, pero uno por
      // descarga se acumularía en el `body` durante toda la sesión.
      descargarArchivo(new Blob(['x']), 'boleta.pdf');

      expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    });

    it('un fallo no dispara ninguna descarga', () => {
      // El 403 llega antes que el blob: sin esto se guardaría un archivo con el
      // cuerpo del error dentro y extensión .pdf.
      let fallo: unknown;
      servicio.descargarBoleta(9).subscribe({ error: (error: unknown) => (fallo = error) });

      http.expectOne(`${URL}/boleta/9`).flush(null, { status: 403, statusText: 'Forbidden' });

      expect(fallo).toBeDefined();
      expect(pulsado).toHaveLength(0);
      expect(crear).not.toHaveBeenCalled();
    });
  });
});
