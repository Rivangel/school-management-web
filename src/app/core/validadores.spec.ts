import { FormControl } from '@angular/forms';

import { textoRequerido } from './validadores';

describe('textoRequerido', () => {
  it('acepta un texto con contenido', () => {
    expect(textoRequerido(new FormControl('Ana'))).toBeNull();
  });

  it('rechaza la cadena vacía', () => {
    expect(textoRequerido(new FormControl(''))).toEqual({ required: true });
  });

  it('rechaza un campo que sólo tiene espacios', () => {
    // El caso que motiva el validador: `Validators.required` lo daría por bueno
    // y el `@NotBlank` de la API lo rechazaría con un 400.
    expect(textoRequerido(new FormControl('   '))).toEqual({ required: true });
  });

  it('rechaza lo que no sea texto', () => {
    expect(textoRequerido(new FormControl(null))).toEqual({ required: true });
    expect(textoRequerido(new FormControl(undefined))).toEqual({ required: true });
  });
});
