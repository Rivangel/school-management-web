import { ColumnaCsv, exportarCsv } from './exportar-csv';

interface Fila {
  readonly nombre: string;
  readonly edad: number;
}

describe('exportarCsv', () => {
  let crear: ReturnType<typeof vi.spyOn>;
  let pulsado: HTMLAnchorElement[];

  const columnas: ColumnaCsv<Fila>[] = [
    { encabezado: 'Nombre', valor: (fila) => fila.nombre },
    { encabezado: 'Edad', valor: (fila) => fila.edad },
  ];

  beforeEach(() => {
    // `URL` de jsdom es de verdad: se espía en vez de sustituirla, igual que en
    // `reporte-service.spec.ts`.
    crear = vi.spyOn(globalThis.URL, 'createObjectURL');
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

  it('descarga con el nombre de archivo dado', () => {
    exportarCsv('alumnos.csv', columnas, [{ nombre: 'Ana', edad: 10 }]);

    expect(pulsado).toHaveLength(1);
    expect(pulsado[0].download).toBe('alumnos.csv');
  });

  it('arma encabezado y filas entre comillas, separados por coma y CRLF', async () => {
    exportarCsv('x.csv', columnas, [
      { nombre: 'Ana', edad: 10 },
      { nombre: 'Beto', edad: 7 },
    ]);

    const blob = crear.mock.calls[0][0] as Blob;
    // `Blob.text()` decodifica como UTF-8 y por eso descarta la marca BOM: es
    // el mismo comportamiento con el que Excel la reconoce y la esconde. Por
    // eso el BOM se comprueba aparte, a nivel de bytes.
    const texto = await blob.text();

    expect(texto).toBe('"Nombre","Edad"\r\n"Ana","10"\r\n"Beto","7"');
  });

  it('lleva una marca BOM UTF-8 al principio de los bytes', async () => {
    exportarCsv('x.csv', columnas, [{ nombre: 'Ana', edad: 10 }]);

    const blob = crear.mock.calls[0][0] as Blob;
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('duplica las comillas que ya traiga un valor, para no romper el CSV', async () => {
    exportarCsv('x.csv', columnas, [{ nombre: 'La "Jefa"', edad: 30 }]);

    const blob = crear.mock.calls[0][0] as Blob;
    const texto = await blob.text();

    expect(texto).toContain('"La ""Jefa"""');
  });

  it('una coma o un salto de línea dentro de un valor no corre las columnas', async () => {
    exportarCsv('x.csv', columnas, [{ nombre: 'García, S.A.\nsegunda línea', edad: 1 }]);

    const blob = crear.mock.calls[0][0] as Blob;
    const texto = await blob.text();
    const [, segundaFila] = texto.split('\r\n');

    expect(segundaFila).toBe('"García, S.A.\nsegunda línea","1"');
  });

  it('sin filas exporta sólo el encabezado', async () => {
    exportarCsv('vacio.csv', columnas, []);

    const blob = crear.mock.calls[0][0] as Blob;
    const texto = await blob.text();

    expect(texto).toBe('"Nombre","Edad"');
  });

  it('el tipo del blob es CSV en UTF-8', () => {
    exportarCsv('x.csv', columnas, []);

    const blob = crear.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8;');
  });
});
