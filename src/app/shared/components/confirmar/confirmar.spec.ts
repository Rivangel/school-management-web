import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { Confirmar, DatosConfirmacion } from './confirmar';

const DATOS: DatosConfirmacion = {
  titulo: 'Eliminar alumno',
  mensaje: '¿Seguro que quieres eliminar a Ana López?',
  confirmar: 'Eliminar',
  peligro: true,
};

describe('Confirmar', () => {
  let dialogo: MatDialog;

  /** Abre y dibuja: el diálogo se monta en un overlay, no en un fixture. */
  function abrir() {
    const referencia = dialogo.open<Confirmar, DatosConfirmacion, boolean>(Confirmar, {
      data: DATOS,
    });
    TestBed.tick();
    return referencia;
  }

  function boton(etiqueta: string): HTMLButtonElement {
    return [...document.querySelectorAll('mat-dialog-actions button')].find((candidato) =>
      candidato.textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    dialogo = TestBed.inject(MatDialog);
  });

  it('enseña el mensaje y la acción que se va a ejecutar', () => {
    abrir();

    // El botón dice qué hace: un "Aceptar" obliga a releer el mensaje.
    expect(document.body.textContent).toContain('¿Seguro que quieres eliminar a Ana López?');
    expect(boton('Eliminar')).toBeTruthy();
  });

  it('confirmar cierra con true', async () => {
    const referencia = abrir();
    boton('Eliminar').click();

    await expect(firstValueFrom(referencia.afterClosed())).resolves.toBe(true);
  });

  it('cancelar cierra sin confirmar', async () => {
    const referencia = abrir();
    boton('Cancelar').click();

    await expect(firstValueFrom(referencia.afterClosed())).resolves.toBe(false);
  });

  it('cerrarlo por fuera tampoco confirma', async () => {
    // Escapar o pulsar el fondo cierran sin valor: ante la duda, no pasa nada.
    const referencia = abrir();
    referencia.close();

    await expect(firstValueFrom(referencia.afterClosed())).resolves.toBeUndefined();
  });
});
