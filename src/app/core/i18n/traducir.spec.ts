import { cambiarIdioma } from './estado';
import { t } from './traducir';

describe('t', () => {
  afterEach(() => cambiarIdioma('es'));

  it('devuelve el texto en español por defecto', () => {
    expect(t('confirmar.cancelar')).toBe('Cancelar');
  });

  it('devuelve el texto en inglés al cambiar de idioma', () => {
    cambiarIdioma('en');
    expect(t('confirmar.cancelar')).toBe('Cancel');
  });

  it('interpola los parámetros', () => {
    expect(t('alumnos.lista.registrados', { n: 4 })).toBe('4 alumnos registrados.');
  });

  it('cae al español si la clave no existe en inglés', () => {
    cambiarIdioma('en');
    // 'shell.marca' es igual en los dos idiomas, así que no está en en.ts:
    // demuestra el respaldo sin depender de que nadie lo borre por descuido.
    expect(t('shell.marca')).toBe('School Management');
  });

  it('enseña la clave tal cual si no existe en ningún idioma', () => {
    expect(t('esto.no.existe')).toBe('esto.no.existe');
  });

  it('dentro de la clave que no existe, no revienta si un tramo intermedio es un texto', () => {
    expect(t('confirmar.cancelar.algo')).toBe('confirmar.cancelar.algo');
  });

  it('deja intacto un parámetro que no llegó', () => {
    expect(t('home.saludo', {})).toBe('Hola, {{nombre}}');
  });
});
