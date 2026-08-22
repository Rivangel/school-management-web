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
import { AlumnoService } from '../../../core/services/alumno-service';
import { AuthService } from '../../../core/services/auth-service';
import { CalificacionService } from '../../../core/services/calificacion-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';

/** Cuántos alumnos caben en el selector; es también el tope de la API. */
const ALUMNOS_EN_EL_SELECTOR = 100;

/** Columnas de la tabla. No hay `sort` de servidor: esto no viene paginado. */
const COLUMNAS = ['materia', 'periodo', 'calificacion'] as const;

/**
 * Calificaciones de un alumno.
 *
 * Primera pantalla de consulta que **no es un listado paginado**: la API
 * devuelve el arreglo entero de notas de una persona, así que no hay paginador,
 * ni `sort` que mandar, ni `listadoPaginado` que reutilizar.
 *
 * Y la primera que se comporta distinto según quién entre, no en qué botones
 * enseña sino en **a quién consulta**: el ADMIN y el MAESTRO eligen alumno; el
 * ALUMNO ve lo suyo y no elige nada, porque la API sólo le deja lo suyo.
 */
@Component({
  selector: 'app-calificaciones-alumno',
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
  templateUrl: './calificaciones-alumno.html',
  styleUrl: './calificaciones-alumno.scss',
})
export class CalificacionesAlumno {
  private readonly calificaciones = inject(CalificacionService);
  private readonly alumnos = inject(AlumnoService);
  private readonly auth = inject(AuthService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly columnas: string[] = [...COLUMNAS];

  protected readonly esAlumno = computed(() => this.auth.rol() === 'ALUMNO');
  protected readonly puedeRegistrar = computed(() => this.auth.tieneAlgunRol(...ROLES_REGISTRO));

  private readonly query = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });

  /**
   * El alumno elegido en el selector, leído de la URL y **validado**.
   *
   * Vive en la URL como la página y el filtro de los listados: así el enlace
   * "las notas de Ana" se comparte y se recarga entero. Un valor que no es un
   * entero positivo se descarta en vez de viajar — la API lo devolvería como un
   * 400 y la pantalla enseñaría un error donde debería haber un selector vacío.
   */
  private readonly alumnoDeLaUrl = computed(() => {
    const crudo = this.query().get('alumnoId');
    if (crudo === null || !/^\d+$/.test(crudo) || Number(crudo) === 0) {
      return undefined;
    }
    return Number(crudo);
  });

  /**
   * Quién es el alumno que ha entrado, cuando lo es.
   *
   * El ADMIN y el MAESTRO no lo preguntan: no tienen alumno vinculado y la API
   * les respondería 404.
   */
  private readonly alumnoActual = rxResource({
    params: () => (this.esAlumno() ? true : undefined),
    stream: () => this.alumnos.obtenerActual(),
  });

  /** Los alumnos del selector. Un ALUMNO no lo tiene y no los pide. */
  private readonly paginaDeAlumnos = rxResource({
    params: () => (this.esAlumno() ? undefined : true),
    stream: () => this.alumnos.listar({ size: ALUMNOS_EN_EL_SELECTOR, sort: 'apellido,asc' }),
  });

  protected readonly opcionesDeAlumno = computed(() =>
    this.paginaDeAlumnos.hasValue() ? this.paginaDeAlumnos.value().content : [],
  );

  protected readonly alumnosNoListados = computed(() => {
    const pagina = this.paginaDeAlumnos.hasValue() ? this.paginaDeAlumnos.value() : undefined;
    return pagina === undefined ? 0 : pagina.totalElements - pagina.content.length;
  });

  /**
   * De quién se enseñan las notas: el de la URL, o el propio si entró un alumno.
   *
   * Para un ALUMNO el `?alumnoId=` de la URL **se ignora a propósito**: pedir el
   * de otro sólo conseguiría un 403, así que la pantalla no lo intenta.
   */
  private readonly alumnoConsultado = computed(() => {
    if (this.esAlumno()) {
      return this.alumnoActual.hasValue() ? this.alumnoActual.value().id : undefined;
    }
    return this.alumnoDeLaUrl();
  });

  /** `null` es "ninguno elegido": el `mat-select` no admite `undefined`. */
  protected readonly alumnoElegido = computed(() => this.alumnoDeLaUrl() ?? null);

  /** Nombre de quien se está consultando, para la cabecera. */
  protected readonly nombreConsultado = computed(() => {
    if (this.esAlumno()) {
      const yo = this.alumnoActual.hasValue() ? this.alumnoActual.value() : undefined;
      return yo === undefined ? '' : `${yo.nombre} ${yo.apellido}`;
    }
    const id = this.alumnoDeLaUrl();
    const alumno = this.opcionesDeAlumno().find((candidato) => candidato.id === id);
    return alumno === undefined ? '' : `${alumno.nombre} ${alumno.apellido}`;
  });

  /** Sin alumno elegido no se pide nada: `params` en `undefined`. */
  private readonly recurso = rxResource({
    params: () => this.alumnoConsultado(),
    stream: ({ params }) => this.calificaciones.listarPorAlumno(params),
  });

  /**
   * Las notas, ordenadas **aquí**.
   *
   * Ordenar en el cliente fue el error del Día 18 y aquí es lo correcto, por la
   * misma razón que allí no lo era: entonces la pantalla tenía en memoria una
   * página de veinte filas de un total mayor; ahora tiene el arreglo completo,
   * no hay paginador que descuadrar ni `sort` que la API sepa interpretar.
   *
   * Por periodo descendente —lo último cursado es lo que se viene a mirar— y
   * dentro de cada periodo por materia.
   */
  protected readonly filas = computed(() => {
    const recibidas = this.recurso.hasValue() ? this.recurso.value() : [];
    return [...recibidas].sort(
      (una, otra) =>
        otra.periodo.localeCompare(una.periodo) ||
        una.materiaNombre.localeCompare(otra.materiaNombre),
    );
  });

  protected readonly cargando = computed(
    () => this.recurso.isLoading() || this.alumnoActual.isLoading(),
  );

  protected readonly sinElegir = computed(() => this.alumnoConsultado() === undefined);

  protected readonly vacio = computed(
    () => !this.sinElegir() && !this.cargando() && this.filas().length === 0,
  );

  /**
   * El promedio de lo que se está enseñando.
   *
   * Se calcula sobre **todas** las notas del alumno, de todos los periodos, que
   * es lo que hay en la tabla. La API no expone ningún promedio y este no se
   * guarda en ningún sitio: es una cuenta de la pantalla.
   *
   * A propósito **no** se marca ninguna nota como aprobada o reprobada: la API
   * no define cuál es la mínima, y ponerla aquí sería inventarse una regla de
   * negocio que nadie ha escrito.
   */
  protected readonly promedio = computed(() => {
    const filas = this.filas();
    if (filas.length === 0) {
      return null;
    }
    const suma = filas.reduce((total, fila) => total + fila.calificacion, 0);
    return Math.round((suma / filas.length) * 100) / 100;
  });

  protected readonly error = computed(() => {
    const fallo = this.recurso.error() ?? this.alumnoActual.error();
    return fallo === undefined
      ? null
      : mensajeDeError(fallo, 'No se pudieron cargar las calificaciones.');
  });

  protected elegirAlumno(alumnoId: number | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { alumnoId },
      queryParamsHandling: 'merge',
    });
  }

  protected reintentar(): void {
    this.alumnoActual.reload();
    this.recurso.reload();
  }

  /** Para el `track` de la tabla. */
  protected readonly idDe = (_indice: number, calificacion: Calificacion): number =>
    calificacion.id;
}
