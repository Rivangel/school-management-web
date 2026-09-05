import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Avisos } from './avisos';

describe('Avisos', () => {
  let avisos: Avisos;
  let abrir: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    avisos = TestBed.inject(Avisos);
    // Se espía el `open` en vez de dejarlo abrir: lo que se comprueba es qué
    // pide este servicio, no que Material sepa dibujar un overlay.
    abrir = vi.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue(undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * El `MatSnackBar` se importa dentro del método, así que el aviso no sale en
   * el mismo tick: hay que esperar a que se resuelva ese import.
   */
  async function esperarAlAviso(): Promise<void> {
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
  }

  it('un acierto se enseña menos tiempo que un fallo', async () => {
    // Un acierto se lee de un vistazo; un fallo hay que leerlo entero, y ocho
    // segundos es lo que cuesta leer una frase que además propone qué hacer.
    avisos.exito('Alumno guardado');
    await esperarAlAviso();

    expect(abrir).toHaveBeenCalledWith('Alumno guardado', 'Cerrar', {
      duration: 5000,
      panelClass: 'aviso--exito',
    });

    abrir.mockClear();
    avisos.error('No se pudo guardar');
    await esperarAlAviso();

    expect(abrir).toHaveBeenCalledWith('No se pudo guardar', 'Cerrar', {
      duration: 8000,
      panelClass: 'aviso--error',
    });
  });

  it('el aviso siempre se puede cerrar antes de tiempo', async () => {
    // El botón importa en el de error: ocho segundos tapando una esquina son
    // muchos si ya se leyó, y en móvil el aviso se come el pie de la pantalla.
    avisos.error('No se pudo contactar con el servidor.');
    await esperarAlAviso();

    expect(abrir.mock.calls[0][1]).toBe('Cerrar');
  });

  it('se traga el aviso si el inyector ya no está cuando llega el import', async () => {
    // El aviso se pide y se olvida (`void`), así que su promesa no tiene quién
    // la espere: si el inyector muere entre la petición y el import —un test
    // que reinicia el TestBed, una navegación que se lleva la pantalla— el
    // `inyector.get` lanza y el rechazo quedaría sin capturar, que en vitest
    // tumba el archivo entero por un aviso que ya no le importaba a nadie.
    avisos.error('Da igual');
    TestBed.resetTestingModule();

    await new Promise((listo) => setTimeout(listo));

    expect(abrir).not.toHaveBeenCalled();
  });
});
