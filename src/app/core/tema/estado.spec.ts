import { alternarTema, cambiarTema, temaActual } from './estado';

describe('estado del tema', () => {
  afterEach(() => {
    // El estado es un módulo compartido: sin esto, un test que cambia a
    // oscuro dejaría el siguiente arrancando en el tema equivocado.
    cambiarTema('claro');
    localStorage.clear();
  });

  it('cambia el tema y lo recuerda en localStorage', () => {
    cambiarTema('oscuro');

    expect(temaActual()).toBe('oscuro');
    expect(localStorage.getItem('school-management.tema')).toBe('oscuro');
  });

  it('marca el atributo data-tema en <html>, del que cuelgan las variables CSS', () => {
    cambiarTema('oscuro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');

    cambiarTema('claro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
  });

  it('alternar va de claro a oscuro y de vuelta', () => {
    alternarTema();
    expect(temaActual()).toBe('oscuro');

    alternarTema();
    expect(temaActual()).toBe('claro');
  });

  it('no hace nada si se "cambia" al tema que ya estaba puesto', () => {
    cambiarTema('claro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
  });
});
