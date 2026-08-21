import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';

import { MateriaRequest } from '../../../core/models';
import { Avisos } from '../../../core/services/avisos';
import {
  ERROR_SERVIDOR,
  PistaDeCampo,
  aplicarErroresDeApi,
} from '../../../core/services/errores-formulario';
import { MaestroService } from '../../../core/services/maestro-service';
import { MateriaService } from '../../../core/services/materia-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { textoRequerido } from '../../../core/validadores';
import { idDeRuta } from '../../../shared/id-de-ruta';

/** Cuántos maestros caben en el desplegable; es también el tope de la API. */
const MAESTROS_EN_EL_SELECTOR = 100;

/** Los créditos que acepta la API (`@Min(1)` y `@Max(20)` de `MateriaRequest`). */
const CREDITOS_MINIMO = 1;
const CREDITOS_MAXIMO = 20;

/**
 * Cómo repartir los errores que la API no desglosa por campo.
 *
 * El nombre de una materia **no es único** —dos grupos pueden llamar igual a
 * Álgebra—, así que aquí no hay ningún duplicado que colocar. Lo que sí hay es
 * un caso que los otros formularios no tienen: elegir a un maestro que ya no
 * existe. La API lo responde con un **404** (busca al maestro antes de guardar),
 * no con un 400, y su frase —"Maestro con id 3 no encontrado"— habla de un id
 * que quien rellena el formulario nunca vio, porque eligió un nombre en una
 * lista. Se cuelga del desplegable con palabras propias.
 */
const PISTAS: readonly PistaDeCampo[] = [
  {
    patron: /maestro/i,
    campo: 'maestroId',
    mensaje: 'Ese maestro ya no existe. Elige otro en la lista, que se acaba de actualizar.',
  },
];

/** Una opción del desplegable de maestros. */
interface OpcionDeMaestro {
  readonly id: number;
  readonly etiqueta: string;
}

/**
 * Alta y edición de una materia.
 *
 * Tercer formulario del patrón: una **ruta** (`/materias/nueva` y
 * `/materias/7/editar`), el mismo componente para los dos modos y los enlaces
 * arrastrando el `?page=&size=&sort=` del listado.
 *
 * Lo que trae de nuevo es un campo que **apunta a otro registro**: la materia no
 * guarda el nombre de su maestro, guarda su id. Eso obliga a pedir dos cosas a
 * la vez y a que el desplegable siga teniendo sentido cuando la lista de
 * maestros no alcanza para explicar lo que la materia ya tiene guardado.
 */
@Component({
  selector: 'app-formulario-materia',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './formulario-materia.html',
  styleUrl: './formulario-materia.scss',
})
export class FormularioMateria {
  private readonly materias = inject(MateriaService);
  private readonly maestros = inject(MaestroService);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);

  protected readonly creditosMinimo = CREDITOS_MINIMO;
  protected readonly creditosMaximo = CREDITOS_MAXIMO;

  /**
   * Los límites son los de `MateriaRequest`.
   *
   * `maestroId` empieza en `null` y no en `0`: el desplegable tiene que abrir
   * sin nada elegido, y un `0` sería un id que la API rechazaría con un
   * `@Positive`. `Validators.required` lo da por vacío, que es justo lo que es.
   */
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    nombre: ['', [textoRequerido, Validators.maxLength(100)]],
    creditos: [
      null as number | null,
      [Validators.required, Validators.min(CREDITOS_MINIMO), Validators.max(CREDITOS_MAXIMO)],
    ],
    maestroId: [null as number | null, Validators.required],
  });

  private readonly enLaRuta = idDeRuta();

  /** El id que se va a actualizar, o `undefined` si esto es un alta. */
  protected readonly id = this.enLaRuta.id;

  /** `/materias/abc/editar`: hay id en la ruta y no es un número. */
  protected readonly idInvalido = this.enLaRuta.invalido;

  protected readonly editando = this.enLaRuta.presente;

  /** Sin `id` los parámetros son `undefined` y el recurso ni llega a pedir nada. */
  private readonly materia = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.materias.obtenerPorId(params),
  });

  /** Los maestros entre los que se elige. Se piden una vez, al montar. */
  private readonly recursoMaestros = rxResource({
    stream: () => this.maestros.listar({ size: MAESTROS_EN_EL_SELECTOR }),
  });

  /**
   * Espera también a los maestros, no sólo a la materia.
   *
   * Con el desplegable todavía vacío, abrirlo no ofrece nada y el campo parece
   * roto; y en una edición, elegir antes de que llegue la ficha sólo consigue
   * que la respuesta pise lo elegido.
   */
  protected readonly cargando = computed(
    () => this.materia.isLoading() || this.recursoMaestros.isLoading(),
  );

  protected readonly enviando = signal(false);

  /** Aviso al pie: lo que la API objetó y no se pudo colgar de ningún campo. */
  protected readonly error = signal<string | null>(null);

  protected readonly errorDeCarga = computed(() => {
    const fallo = this.materia.error();
    return fallo === undefined ? null : mensajeDeError(fallo, 'No se pudo cargar la materia.');
  });

  /**
   * Las opciones del desplegable, con la del maestro de la propia materia
   * garantizada.
   *
   * La API devuelve como mucho cien maestros y el listado no se busca ni se
   * pagina aquí, así que en una escuela grande el maestro que la materia tiene
   * guardado puede **no venir en la lista**. Sin esta red, `mat-select` no
   * encuentra su valor entre las opciones y se dibuja vacío: la pantalla diría
   * que la materia no tiene maestro, y quien la editara para arreglar el nombre
   * acabaría reasignándola sin querer.
   *
   * El respaldo se etiqueta con el `maestroNombre` que ya trae la respuesta —el
   * DTO lo compone—, así que no cuesta ninguna petición más.
   */
  protected readonly opcionesDeMaestro = computed<OpcionDeMaestro[]>(() => {
    const opciones = this.maestrosDisponibles().map((maestro) => ({
      id: maestro.id,
      etiqueta: `${maestro.apellido}, ${maestro.nombre}`,
    }));

    const actual = this.materia.hasValue() ? this.materia.value() : undefined;
    if (actual === undefined || opciones.some((opcion) => opcion.id === actual.maestroId)) {
      return opciones;
    }
    return [...opciones, { id: actual.maestroId, etiqueta: actual.maestroNombre }];
  });

  private maestrosDisponibles() {
    return this.recursoMaestros.hasValue() ? this.recursoMaestros.value().content : [];
  }

  constructor() {
    // `reset` y no `patchValue`: los campos recién cargados no son cambios del
    // usuario, así que tienen que quedar prístinos.
    effect(() => {
      if (!this.materia.hasValue()) {
        return;
      }
      const { nombre, creditos, maestroId } = this.materia.value();
      this.formulario.reset({ nombre, creditos, maestroId });
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
      id === undefined ? this.materias.crear(datos) : this.materias.actualizar(id, datos);

    peticion.subscribe({
      next: (materia) => {
        this.enviando.set(false);
        this.avisos.exito(
          id === undefined
            ? `Materia ${materia.nombre} registrada.`
            : `Se guardaron los cambios de ${materia.nombre}.`,
        );
        this.volver();
      },
      error: (fallo: unknown) => {
        this.enviando.set(false);
        this.error.set(
          aplicarErroresDeApi(this.formulario, fallo, PISTAS, 'No se pudo guardar la materia.'),
        );

        // Si el fallo acabó en el desplegable, es que su lista se quedó vieja:
        // el maestro que se eligió ya no está. Volver a pedirla es lo único que
        // le permite al usuario resolverlo sin recargar la pantalla entera.
        if (this.formulario.controls.maestroId.hasError(ERROR_SERVIDOR)) {
          this.recursoMaestros.reload();
        }
      },
    });
  }

  protected reintentar(): void {
    this.materia.reload();
  }

  /** `preserve` conserva el `?page=&size=&sort=` con el que se entró al listado. */
  protected volver(): void {
    void this.router.navigate(['/materias'], { queryParamsHandling: 'preserve' });
  }

  /**
   * Lo que se envía, recortado. Los dos números salen ya validados del
   * formulario, así que el `!` no esconde ninguna duda: `Validators.required`
   * no habría dejado llegar hasta aquí un `null`.
   */
  private valores(): MateriaRequest {
    const { nombre, creditos, maestroId } = this.formulario.getRawValue();
    return {
      nombre: nombre.trim(),
      creditos: creditos!,
      maestroId: maestroId!,
    };
  }
}
