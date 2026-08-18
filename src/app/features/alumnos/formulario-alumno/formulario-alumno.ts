import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';

import { AlumnoRequest } from '../../../core/models';
import { AlumnoService } from '../../../core/services/alumno-service';
import { Avisos } from '../../../core/services/avisos';
import { PistaDeCampo, aplicarErroresDeApi } from '../../../core/services/errores-formulario';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { textoRequerido } from '../../../core/validadores';

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
 * Alta y edición de un alumno.
 *
 * Es una **ruta** y no un diálogo: el listado ya guarda su estado en la URL, así
 * que `/alumnos/7/editar` se puede compartir, recargar y cerrar con el botón
 * "atrás" como cualquier otra pantalla. A cambio hay que arrastrar los
 * parámetros del listado (`?page=&sort=`) al navegar, que es lo que permite
 * volver exactamente a la página desde la que se entró sin guardar nada.
 *
 * El mismo componente sirve para los dos modos: sin `id` en la ruta es un alta y
 * el recurso ni se pide. Separarlos duplicaría cinco campos, sus validaciones y
 * sus mensajes para no ahorrar más que un `if` al enviar.
 */
@Component({
  selector: 'app-formulario-alumno',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
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
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);

  /** Los máximos son los `@Size` de `AlumnoRequest`; el mínimo, su `@NotBlank`. */
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    nombre: ['', [textoRequerido, Validators.maxLength(100)]],
    apellido: ['', [textoRequerido, Validators.maxLength(100)]],
    matricula: ['', [textoRequerido, Validators.maxLength(20)]],
    email: ['', [textoRequerido, Validators.email, Validators.maxLength(120)]],
    grupo: ['', [textoRequerido, Validators.maxLength(10)]],
  });

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  private readonly idEnLaUrl = computed(() => this.parametros().get('id'));

  /** El id que se va a actualizar, o `undefined` si esto es un alta. */
  protected readonly id = computed(() => {
    const crudo = this.idEnLaUrl();
    return crudo !== null && /^\d+$/.test(crudo) ? Number(crudo) : undefined;
  });

  /**
   * `/alumnos/abc/editar`: hay id en la ruta pero no es un número.
   *
   * Se distingue del alta a propósito. Sin esta comprobación el formulario se
   * abriría vacío y el primer guardado crearía un alumno nuevo, que no es en
   * absoluto lo que pedía quien entró por ese enlace.
   */
  protected readonly idInvalido = computed(
    () => this.idEnLaUrl() !== null && this.id() === undefined,
  );

  protected readonly editando = computed(() => this.idEnLaUrl() !== null);

  /** Sin `id` los parámetros son `undefined` y el recurso ni llega a pedir nada. */
  private readonly alumno = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.alumnos.obtenerPorId(params),
  });

  protected readonly cargando = this.alumno.isLoading;
  protected readonly enviando = signal(false);

  /** Aviso al pie: lo que la API objetó y no se pudo colgar de ningún campo. */
  protected readonly error = signal<string | null>(null);

  protected readonly errorDeCarga = computed(() => {
    const fallo = this.alumno.error();
    return fallo === undefined ? null : mensajeDeError(fallo, 'No se pudo cargar el alumno.');
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

    const id = this.id();
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
            ? `Alumno ${alumno.nombre} ${alumno.apellido} registrado.`
            : `Se guardaron los cambios de ${alumno.nombre} ${alumno.apellido}.`,
        );
        this.volver();
      },
      error: (fallo: unknown) => {
        this.enviando.set(false);
        this.error.set(
          aplicarErroresDeApi(this.formulario, fallo, DUPLICADOS, 'No se pudo guardar el alumno.'),
        );
      },
    });
  }

  protected reintentar(): void {
    this.alumno.reload();
  }

  /**
   * Vuelve al listado tal y como estaba.
   *
   * `preserve` conserva el `?page=&size=&sort=` que el listado dejó en la URL al
   * entrar aquí: sin él, guardar devuelve siempre a la primera página, que casi
   * nunca es la que se estaba mirando.
   */
  protected volver(): void {
    void this.router.navigate(['/alumnos'], { queryParamsHandling: 'preserve' });
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
