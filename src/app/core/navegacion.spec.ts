import { MENU, ROLES_ESCRITURA, menuPara, rolesDe } from './navegacion';

describe('menuPara', () => {
  function etiquetas(rol: Parameters<typeof menuPara>[0]): string[] {
    return menuPara(rol).map((elemento) => elemento.etiqueta);
  }

  it('el ADMIN ve todas las secciones', () => {
    expect(menuPara('ADMIN')).toHaveLength(MENU.length);
  });

  // La API deja consultar todo al MAESTRO; lo que le cierra son las escrituras,
  // que se ocultan dentro de cada pantalla (Día 28), no en el menú.
  it('el MAESTRO llega a las mismas secciones que el ADMIN', () => {
    expect(etiquetas('MAESTRO')).toEqual(etiquetas('ADMIN'));
  });

  it('el ALUMNO no ve la gestión de alumnos ni de maestros', () => {
    const visibles = etiquetas('ALUMNO');

    expect(visibles).not.toContain('Alumnos');
    expect(visibles).not.toContain('Maestros');
    expect(visibles).toContain('Calificaciones');
  });

  it('sin sesión no hay menú', () => {
    expect(menuPara(null)).toEqual([]);
  });

  it('conserva el orden declarado', () => {
    expect(etiquetas('ADMIN')[0]).toBe('Inicio');
  });
});

describe('rolesDe', () => {
  it('devuelve los roles declarados para la sección', () => {
    expect(rolesDe('/alumnos')).toEqual(['ADMIN', 'MAESTRO']);
  });

  it('protesta ante una ruta que no está en el menú', () => {
    expect(() => rolesDe('/inventada')).toThrowError(/no está en el menú/);
  });
});

describe('ROLES_ESCRITURA', () => {
  it('reserva las escrituras al ADMIN', () => {
    // Espejo de `SecurityConfig`: el MAESTRO consulta alumnos pero recibe 403 al
    // crear, actualizar o borrar.
    expect([...ROLES_ESCRITURA]).toEqual(['ADMIN']);
  });

  it('sólo incluye roles que ven la sección de alumnos', () => {
    // Un rol que pudiera escribir sin tener la sección en el menú llegaría al
    // formulario sin poder volver al listado.
    for (const rol of ROLES_ESCRITURA) {
      expect(rolesDe('/alumnos')).toContain(rol);
    }
  });
});
