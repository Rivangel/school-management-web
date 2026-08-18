import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

/** Lo que hay que decirle al usuario antes de hacer algo que no se deshace. */
export interface DatosConfirmacion {
  readonly titulo: string;
  readonly mensaje: string;
  /** Texto del botón que confirma. Que diga **qué hace**, no "Aceptar". */
  readonly confirmar: string;
  /** Pinta la acción como destructiva (borrados). */
  readonly peligro?: boolean;
}

/**
 * Diálogo de confirmación para acciones irreversibles.
 *
 * Cierra con `true` sólo si se pulsa el botón de confirmar: escapar, pulsar
 * fuera o cancelar cierran con `undefined`, que es lo que se quiere — ante la
 * duda, no pasa nada.
 *
 * El texto del botón lo pone quien abre el diálogo y describe la acción
 * ("Eliminar"), porque un "Aceptar" obliga a releer el mensaje para saber qué se
 * está aceptando.
 */
@Component({
  selector: 'app-confirmar',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo }}</h2>
    <mat-dialog-content>
      <p>{{ datos.mensaje }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogo.close(false)">Cancelar</button>
      <button
        mat-flat-button
        type="button"
        cdkFocusInitial
        [class.confirmar--peligro]="datos.peligro"
        (click)="dialogo.close(true)"
      >
        {{ datos.confirmar }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .confirmar--peligro {
      --mdc-filled-button-container-color: var(--mat-sys-error);
      --mdc-filled-button-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class Confirmar {
  protected readonly datos = inject<DatosConfirmacion>(MAT_DIALOG_DATA);
  protected readonly dialogo = inject<MatDialogRef<Confirmar, boolean>>(MatDialogRef);
}
