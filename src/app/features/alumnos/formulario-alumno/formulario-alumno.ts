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
import { AlumnoRequest } from '../../../core/models';
import { AlumnoService } from '../../../core/services/alumno-service';
import { Avisos } from '../../../core/services/avisos';
import { PistaDeCampo, aplicarErroresDeApi } from '../../../core/services/errores-formulario';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { textoRequerido } from '../../../core/validadores';

/** Lo que trae el diálogo al abrirse: sin `id` es un alta. */
export interface DatosFormularioAlumno {
  readonly id?: number;
}

/**
 * Cómo repartir los 400 de negocio, que llegan sin desglose por campo.
 *
 * Son los dos choques que la API comprueba a mano (`existsByMatricula` /
 * `existsByEmail`) y también los dos errores más probables al dar de alta a
 * alguien, así que merecen señalar el campo culpable en vez de un aviso al pie.
 */
const DUPLICADOS: readonly PistaDeCampo[] = [
  { patron: /matrícula/i, campo: 'matricula' },
  { patron: /email|correo/i, campo: 'email' },
];

/**
 * Alta y edición de un alumno, en un diálogo.
 *
 * El mismo componente sirve para los dos modos: sin `id` en los datos del
 * diálogo es un alta y el recurso ni se pide. Cierra con `true` cuando algo
 * cambió —el listado que lo abrió recarga la página— y con `false` si se
 * canceló sin guardar nada.
 */
@Component({
  selector: 'app-formulario-alumno',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './formulario-alumno.html',
  styleUrl: './formulario-alumno.scss',
})
export class FormularioAlumno {
  private readonly alumnos = inject(AlumnoService);
  private readonly avisos = inject(Avisos);
  private readonly datos = inject<DatosFormularioAlumno>(MAT_DIALOG_DATA);
  private readonly dialogo = inject(MatDialogRef<FormularioAlumno, boolean>);

  protected readonly t = t;

  /** Los máximos son los `@Size` de `AlumnoRequest`; el mínimo, su `@NotBlank`. */
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    nombre: ['', [textoRequerido, Validators.maxLength(100)]],
    apellido: ['', [textoRequerido, Validators.maxLength(100)]],
    matricula: ['', [textoRequerido, Validators.maxLength(20)]],
    email: ['', [textoRequerido, Validators.email, Validators.maxLength(120)]],
    grupo: ['', [textoRequerido, Validators.maxLength(10)]],
  });

  /** El id que se va a actualizar, o `undefined` si esto es un alta. */
  protected readonly id = this.datos.id;
  protected readonly editando = this.id !== undefined;

  /** Sin `id` los parámetros son `undefined` y el recurso ni llega a pedir nada. */
  private readonly alumno = rxResource({
    params: () => this.id,
    stream: ({ params }) => this.alumnos.obtenerPorId(params),
  });

  protected readonly cargando = this.alumno.isLoading;
  protected readonly enviando = signal(false);

  /** Aviso al pie: lo que la API objetó y no se pudo colgar de ningún campo. */
  protected readonly error = signal<string | null>(null);

  protected readonly errorDeCarga = computed(() => {
    const fallo = this.alumno.error();
    return fallo === undefined ? null : mensajeDeError(fallo, t('alumnos.formulario.noSePudoCargar'));
  });

  constructor() {
    // Llega la ficha y el formulario deja de estar vacío. Va con `reset` y no con
    // `patchValue` para que los campos queden **prístinos**: recién cargados no
    // son cambios del usuario.
    effect(() => {
      if (!this.alumno.hasValue()) {
        return;
      }
      const { nombre, apellido, matricula, email, grupo } = this.alumno.value();
      this.formulario.reset({ nombre, apellido, matricula, email, grupo });
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
      id === undefined ? this.alumnos.crear(datos) : this.alumnos.actualizar(id, datos);

    peticion.subscribe({
      next: (alumno) => {
        this.enviando.set(false);
        this.avisos.exito(
          id === undefined
            ? t('alumnos.formulario.registrado', { nombre: alumno.nombre, apellido: alumno.apellido })
            : t('alumnos.formulario.cambiosGuardados', {
                nombre: alumno.nombre,
                apellido: alumno.apellido,
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
            t('alumnos.formulario.noSePudoGuardar'),
          ),
        );
      },
    });
  }

  protected reintentar(): void {
    this.alumno.reload();
  }

  protected cerrar(): void {
    this.dialogo.close(false);
  }

  /**
   * Lo que se envía, recortado.
   *
   * La API recorta por su cuenta, así que esto no la protege de nada: evita que
   * el alumno guardado difiera de lo que se escribió y, sobre todo, que un campo
   * de puros espacios llegue a viajar.
   */
  private valores(): AlumnoRequest {
    const { nombre, apellido, matricula, email, grupo } = this.formulario.getRawValue();
    return {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      matricula: matricula.trim(),
      email: email.trim(),
      grupo: grupo.trim(),
    };
  }
}
