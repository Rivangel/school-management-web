import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';

import { MaestroRequest } from '../../../core/models';
import { Avisos } from '../../../core/services/avisos';
import { PistaDeCampo, aplicarErroresDeApi } from '../../../core/services/errores-formulario';
import { MaestroService } from '../../../core/services/maestro-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { textoRequerido } from '../../../core/validadores';
import { idDeRuta } from '../../../shared/id-de-ruta';

/**
 * Cómo repartir los 400 de negocio, que llegan sin desglose por campo.
 *
 * Aquí sólo hay uno: la API comprueba a mano que el email no esté repetido
 * (`existsByEmail`). Un maestro no tiene matrícula, así que la lista es más
 * corta que la de alumnos, no una copia con un patrón de más.
 */
const DUPLICADOS: readonly PistaDeCampo[] = [{ patron: /email|correo/i, campo: 'email' }];

/**
 * Alta y edición de un maestro.
 *
 * Repite el patrón del formulario de alumnos: es una **ruta** (`/maestros/nuevo`
 * y `/maestros/7/editar`) y no un diálogo, el mismo componente sirve para los dos
 * modos, y los enlaces arrastran el `?page=&size=&sort=` del listado para volver
 * a la página desde la que se entró.
 */
@Component({
  selector: 'app-formulario-maestro',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
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
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);

  /** Los máximos son los `@Size` de `MaestroRequest`; el mínimo, su `@NotBlank`. */
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    nombre: ['', [textoRequerido, Validators.maxLength(100)]],
    apellido: ['', [textoRequerido, Validators.maxLength(100)]],
    especialidad: ['', [textoRequerido, Validators.maxLength(100)]],
    email: ['', [textoRequerido, Validators.email, Validators.maxLength(120)]],
  });

  private readonly enLaRuta = idDeRuta();

  /** El id que se va a actualizar, o `undefined` si esto es un alta. */
  protected readonly id = this.enLaRuta.id;

  /** `/maestros/abc/editar`: hay id en la ruta y no es un número. */
  protected readonly idInvalido = this.enLaRuta.invalido;

  protected readonly editando = this.enLaRuta.presente;

  /** Sin `id` los parámetros son `undefined` y el recurso ni llega a pedir nada. */
  private readonly maestro = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.maestros.obtenerPorId(params),
  });

  protected readonly cargando = this.maestro.isLoading;
  protected readonly enviando = signal(false);

  /** Aviso al pie: lo que la API objetó y no se pudo colgar de ningún campo. */
  protected readonly error = signal<string | null>(null);

  protected readonly errorDeCarga = computed(() => {
    const fallo = this.maestro.error();
    return fallo === undefined ? null : mensajeDeError(fallo, 'No se pudo cargar el maestro.');
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

    const id = this.id();
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
            ? `Maestro ${maestro.nombre} ${maestro.apellido} registrado.`
            : `Se guardaron los cambios de ${maestro.nombre} ${maestro.apellido}.`,
        );
        this.volver();
      },
      error: (fallo: unknown) => {
        this.enviando.set(false);
        this.error.set(
          aplicarErroresDeApi(this.formulario, fallo, DUPLICADOS, 'No se pudo guardar el maestro.'),
        );
      },
    });
  }

  protected reintentar(): void {
    this.maestro.reload();
  }

  /** `preserve` conserva el `?page=&size=&sort=` con el que se entró al listado. */
  protected volver(): void {
    void this.router.navigate(['/maestros'], { queryParamsHandling: 'preserve' });
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
