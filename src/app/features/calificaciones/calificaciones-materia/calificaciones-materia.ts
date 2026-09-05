import { Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Calificacion } from '../../../core/models';
import { ROLES_REGISTRO } from '../../../core/navegacion';
import { AuthService } from '../../../core/services/auth-service';
import { CalificacionService } from '../../../core/services/calificacion-service';
import { MateriaService } from '../../../core/services/materia-service';
import { MiMaestro } from '../../../core/services/mi-maestro';
import { mensajeDeError } from '../../../core/services/mensaje-error';

/** Cuántas materias caben en el selector; es también el tope de la API. */
const MATERIAS_EN_EL_SELECTOR = 100;

const COLUMNAS = ['alumno', 'periodo', 'calificacion'] as const;

/**
 * Calificaciones de una materia.
 *
 * La otra mitad de la consulta: la del Día 21 mira a una persona en todas sus
 * materias y esta mira una materia con todo su grupo. Comparte con ella lo que
 * impone la API —arreglo entero, sin paginar, ordenado aquí— y se diferencia en
 * quién puede abrirla: un ALUMNO consulta lo suyo, no lo de sus compañeros.
 *
 * **Editar es volver a registrar.** La API no tiene `PUT` ni `DELETE` de
 * calificaciones: su `POST` es un *upsert* por alumno, materia y periodo. Así
 * que la columna de acciones no lleva a un formulario de edición distinto, lleva
 * al de registro **con los datos ya puestos**, y el aviso de "vas a reemplazar"
 * del Día 20 sigue apareciendo — que es exactamente lo que se está haciendo.
 */
@Component({
  selector: 'app-calificaciones-materia',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
  ],
  templateUrl: './calificaciones-materia.html',
  styleUrl: './calificaciones-materia.scss',
})
export class CalificacionesMateria {
  private readonly calificaciones = inject(CalificacionService);
  private readonly materias = inject(MateriaService);
  private readonly auth = inject(AuthService);
  private readonly miMaestro = inject(MiMaestro);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly columnas: string[] = [...COLUMNAS, 'acciones'];

  /**
   * Abrir el formulario en blanco. Va por rol y no por materia a propósito: el
   * formulario sólo ofrece al MAESTRO las suyas (Día 20), así que desde aquí no
   * hay forma de llegar a una ajena.
   */
  protected readonly puedeRegistrar = computed(() => this.auth.tieneAlgunRol(...ROLES_REGISTRO));

  private readonly query = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });

  /** La materia elegida, leída de la URL y validada como el resto de filtros. */
  protected readonly materiaId = computed(() => {
    const crudo = this.query().get('materiaId');
    if (crudo === null || !/^\d+$/.test(crudo) || Number(crudo) === 0) {
      return undefined;
    }
    return Number(crudo);
  });

  /**
   * Las materias del desplegable: **todas**, también para un MAESTRO.
   *
   * Leer las notas de una materia no exige ser su maestro —la API no lo pide, a
   * diferencia de registrarlas—, así que la pantalla no se inventa una
   * restricción que el servidor no tiene. Lo que sí puede fallar es guardar, y
   * de eso avisa el formulario.
   */
  private readonly paginaDeMaterias = rxResource({
    stream: () => this.materias.listar({ size: MATERIAS_EN_EL_SELECTOR }),
  });

  protected readonly opcionesDeMateria = computed(() =>
    this.paginaDeMaterias.hasValue() ? this.paginaDeMaterias.value().content : [],
  );

  private readonly materiaVista = computed(() => {
    const id = this.materiaId();
    return this.opcionesDeMateria().find((candidata) => candidata.id === id);
  });

  /**
   * Corregir una nota **de esta materia**, que es más estrecho que registrar.
   *
   * El botón de la cabecera abre el formulario vacío; este lo abre con la materia
   * ya puesta, y si no es suya la API contestará 403 al guardar. Un MAESTRO puede
   * leer las notas de cualquier materia —la API se lo permite— pero corregirlas
   * sólo en las que imparte, así que aquí la pregunta no es qué rol tiene sino de
   * quién es la materia. Ver `MiMaestro`.
   */
  protected readonly puedeCorregir = computed(() =>
    this.miMaestro.puedeRegistrarEn(this.materiaVista()?.maestroId),
  );

  /** Para explicar la ausencia del botón sólo a quien le aplica la regla. */
  protected readonly esMateriaAjena = computed(
    () =>
      this.auth.rol() === 'MAESTRO' &&
      this.materiaVista() !== undefined &&
      !this.miMaestro.esMia(this.materiaVista()?.maestroId),
  );

  protected readonly nombreDeLaMateria = computed(() => {
    const id = this.materiaId();
    const materia = this.opcionesDeMateria().find((candidata) => candidata.id === id);
    return materia?.nombre ?? '';
  });

  /** `null` es "ninguna elegida": el `mat-select` no admite `undefined`. */
  protected readonly materiaElegida = computed(() => this.materiaId() ?? null);

  private readonly recurso = rxResource({
    params: () => this.materiaId(),
    stream: ({ params }) => this.calificaciones.listarPorMateria(params),
  });

  /**
   * Ordenadas aquí, con el arreglo completo delante (ver Día 21): por periodo
   * descendente y, dentro de cada periodo, por alumno — que es como se lee una
   * lista de clase.
   */
  protected readonly filas = computed(() => {
    const recibidas = this.recurso.hasValue() ? this.recurso.value() : [];
    return [...recibidas].sort(
      (una, otra) =>
        otra.periodo.localeCompare(una.periodo) ||
        una.alumnoNombre.localeCompare(otra.alumnoNombre),
    );
  });

  protected readonly cargando = this.recurso.isLoading;
  protected readonly sinElegir = computed(() => this.materiaId() === undefined);
  protected readonly vacio = computed(
    () => !this.sinElegir() && !this.cargando() && this.filas().length === 0,
  );

  /** El promedio del grupo, sobre todas las notas que se están enseñando. */
  protected readonly promedio = computed(() => {
    const filas = this.filas();
    if (filas.length === 0) {
      return null;
    }
    const suma = filas.reduce((total, fila) => total + fila.calificacion, 0);
    return Math.round((suma / filas.length) * 100) / 100;
  });

  protected readonly error = computed(() => {
    const fallo = this.recurso.error();
    return fallo === undefined
      ? null
      : mensajeDeError(fallo, 'No se pudieron cargar las calificaciones de la materia.');
  });

  protected elegirMateria(materiaId: number | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { materiaId },
      queryParamsHandling: 'merge',
    });
  }

  /** Lo que hay que llevar al formulario para corregir una nota concreta. */
  protected parametrosDeEdicion(fila: Calificacion): Record<string, string | number> {
    return {
      alumnoId: fila.alumnoId,
      materiaId: fila.materiaId,
      periodo: fila.periodo,
      calificacion: fila.calificacion,
    };
  }

  protected reintentar(): void {
    this.recurso.reload();
  }

  protected readonly idDe = (_indice: number, fila: Calificacion): number => fila.id;
}
