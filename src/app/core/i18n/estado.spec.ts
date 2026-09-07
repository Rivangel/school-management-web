import { alternarIdioma, cambiarIdioma, idiomaActual, idiomaCambio$ } from './estado';

describe('estado del idioma', () => {
  afterEach(() => {
    // El estado es un módulo compartido: sin esto, un test que cambia a
    // inglés dejaría el siguiente arrancando en el idioma equivocado.
    cambiarIdioma('es');
    localStorage.clear();
  });

  it('empieza en español', () => {
    expect(idiomaActual()).toBe('es');
  });

  it('cambia el idioma y lo recuerda en localStorage', () => {
    cambiarIdioma('en');

    expect(idiomaActual()).toBe('en');
    expect(localStorage.getItem('school-management.idioma')).toBe('en');
  });

  it('actualiza el lang del documento, para que el lector de pantalla acierte el acento', () => {
    cambiarIdioma('en');
    expect(document.documentElement.lang).toBe('en');

    cambiarIdioma('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('alternar va de español a inglés y de vuelta', () => {
    alternarIdioma();
    expect(idiomaActual()).toBe('en');

    alternarIdioma();
    expect(idiomaActual()).toBe('es');
  });

  it('avisa por idiomaCambio$ cuando cambia', () => {
    const recibidos: string[] = [];
    const suscripcion = idiomaCambio$.subscribe((idioma) => recibidos.push(idioma));

    cambiarIdioma('en');
    cambiarIdioma('es');

    expect(recibidos).toEqual(['en', 'es']);
    suscripcion.unsubscribe();
  });

  it('no avisa si se "cambia" al idioma que ya estaba puesto', () => {
    const recibidos: string[] = [];
    const suscripcion = idiomaCambio$.subscribe((idioma) => recibidos.push(idioma));

    cambiarIdioma('es');

    expect(recibidos).toEqual([]);
    suscripcion.unsubscribe();
  });
});
