import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { t } from '../../../core/i18n/traducir';
import { MaestroRequest } from '../../../core/models';
import { Avisos } from '../../../core/services/avisos';
import { PistaDeCampo, aplicarErroresDeApi } from '../../../core/services/errores-formulario';
import { MaestroService } from '../../../core/services/maestro-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { textoRequerido } from '../../../core/validadores';

/** Lo que trae el diálogo al abrirse: sin `id` es un alta. */
export interface DatosFormularioMaestro {
  readonly id?: number;
}

/**
 * Cómo repartir los 400 de negocio, que llegan sin desglose por campo.
 *
 * Aquí sólo hay uno: la API comprueba a mano que el email no esté repetido
 * (`existsByEmail`). Un maestro no tiene matrícula, así que la lista es más
 * corta que la de alumnos, no una copia con un patrón de más.
 */
const DUPLICADOS: readonly PistaDeCampo[] = [{ patron: /email|correo/i, campo: 'email' }];

/**
 * Alta y edición de un maestro, en un diálogo.
 *
 * Repite el patrón del formulario de alumnos: el mismo componente sirve para
 * los dos modos, y cierra con `true` si algo cambió, para que el listado que
 * lo abrió sepa que tiene que recargar.
 */
@Component({
  selector: 'app-formulario-maestro',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './formulario-maestro.html',
  styleUrl: './formulario-maestro.scss',
})
export class FormularioMaestro {
  private readonly maestros = inject(MaestroService);
  private readonly avisos = inject(Avisos);
  private readonly datos = inject<DatosFormularioMaestro>(MAT_DIALOG_DATA);
  private readonly dialogo = inject(MatDialogRef<FormularioMaestro, boolean>);

  protected readonly t = t;

  /** Los máximos son los `@Size` de `MaestroRequest`; el mínimo, su `@NotBlank`. */
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    nombre: ['', [textoRequerido, Validators.maxLength(100)]],
    apellido: ['', [textoRequerido, Validators.maxLength(100)]],
    especialidad: ['', [textoRequerido, Validators.maxLength(100)]],
    email: ['', [textoRequerido, Validators.email, Validators.maxLength(120)]],
  });

  /** El id que se va a actualizar, o `undefined` si esto es un alta. */
  protected readonly id = this.datos.id;
  protected readonly editando = this.id !== undefined;

  /** Sin `id` los parámetros son `undefined` y el recurso ni llega a pedir nada. */
  private readonly maestro = rxResource({
    params: () => this.id,
    stream: ({ params }) => this.maestros.obtenerPorId(params),
  });

  protected readonly cargando = this.maestro.isLoading;
  protected readonly enviando = signal(false);

  /** Aviso al pie: lo que la API objetó y no se pudo colgar de ningún campo. */
  protected readonly error = signal<string | null>(null);

  protected readonly errorDeCarga = computed(() => {
    const fallo = this.maestro.error();
    return fallo === undefined ? null : mensajeDeError(fallo, t('maestros.formulario.noSePudoCargar'));
  });

  constructor() {
    // `reset` y no `patchValue`: los campos recién cargados no son cambios del
    // usuario, así que tienen que quedar prístinos.
    effect(() => {
      if (!this.maestro.hasValue()) {
        return;
      }
      const { nombre, apellido, especialidad, email } = this.maestro.value();
      this.formulario.reset({ nombre, apellido, especialidad, email });
    });
  }

  protected enviar(): void {
    if (this.formulario.invalid) {
      // Sin esto, un formulario vacío enviado con Enter no marca ningún campo:
      // los errores de Material sólo se pintan cuando el control está "touched".
      this.formulario.markAllAsTouched();
      return;
    }

    const id = this.id;
    const datos = this.valores();
    this.enviando.set(true);
    this.error.set(null);

    const peticion =
      id === undefined ? this.maestros.crear(datos) : this.maestros.actualizar(id, datos);

    peticion.subscribe({
      next: (maestro) => {
        this.enviando.set(false);
        this.avisos.exito(
          id === undefined
            ? t('maestros.formulario.registrado', {
                nombre: maestro.nombre,
                apellido: maestro.apellido,
              })
            : t('maestros.formulario.cambiosGuardados', {
                nombre: maestro.nombre,
                apellido: maestro.apellido,
              }),
        );
        this.dialogo.close(true);
      },
      error: (fallo: unknown) => {
        this.enviando.set(false);
        this.error.set(
          aplicarErroresDeApi(
            this.formulario,
            fallo,
            DUPLICADOS,
            t('maestros.formulario.noSePudoGuardar'),
          ),
        );
      },
    });
  }

  protected reintentar(): void {
    this.maestro.reload();
  }

  protected cerrar(): void {
    this.dialogo.close(false);
  }

  /** Lo que se envía, recortado: un campo de puros espacios no llega a viajar. */
  private valores(): MaestroRequest {
    const { nombre, apellido, especialidad, email } = this.formulario.getRawValue();
    return {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      especialidad: especialidad.trim(),
      email: email.trim(),
    };
  }
}
