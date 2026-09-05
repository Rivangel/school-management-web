import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import {
  NOTA_MAXIMA,
  barrasDeAsistencia,
  distribucionDeNotas,
  promedio,
  promedioPorMateria,
  resumenDeAsistencia,
} from '../../core/estadisticas';
import { Calificacion } from '../../core/models';
import { menuPara } from '../../core/navegacion';
import { AlumnoService } from '../../core/services/alumno-service';
import { AsistenciaService } from '../../core/services/asistencia-service';
import { AuthService } from '../../core/services/auth-service';
import { CalificacionService } from '../../core/services/calificacion-service';
import { MaestroService } from '../../core/services/maestro-service';
import { MateriaService } from '../../core/services/materia-service';
import { mensajeDeError } from '../../core/services/mensaje-error';
import { GraficaBarras } from '../../shared/components/grafica-barras/grafica-barras';

/**
 * Cuántas materias entran en las gráficas del ADMIN y el MAESTRO.
 *
 * Es un tope, no un capricho: no hay endpoint que dé los promedios hechos, así
 * que sale **una petición por materia**. Con doce el dashboard hace doce
 * llamadas y ya es bastante; sin tope, una escuela con doscientas materias
 * abriría doscientas al entrar. Lo correcto es pedirlo agregado, y eso es
 * justamente el endpoint de estadísticas del Día 35.
 */
const MATERIAS_EN_LAS_GRAFICAS = 12;

/**
 * Portada y Dashboard de la aplicación, dentro del shell.
 *
 * Muestra tarjetas con conteos estadísticos resumen (alumnos, maestros, materias)
 * para administradores y maestros, y métricas/accesos relevantes para alumnos.
 *
 * <b>Las gráficas no enseñan lo mismo a todo el mundo, y no es una decisión de
 * presentación.</b> El ADMIN y el MAESTRO miran el rendimiento del centro
 * —promedio de cada materia y reparto de las notas—; el ALUMNO mira lo suyo, sus
 * promedios y su asistencia, porque es literalmente lo único que la API le deja
 * pedir. Enseñarle una gráfica del grupo exigiría un endpoint que no tiene y que
 * no debería tener.
 *
 * <b>Falta la asistencia agregada del ADMIN y el MAESTRO</b>, y falta a
 * propósito: `/api/asistencia/materia/{id}` exige una fecha, así que un
 * porcentaje por materia obligaría a recorrer día por día o alumno por alumno.
 * Eso se pide agregado o no se pide — es el endpoint de estadísticas del Día 35.
 */
@Component({
  selector: 'app-home',
  imports: [GraficaBarras, MatCardModule, MatIconModule, MatProgressBarModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly alumnos = inject(AlumnoService);
  private readonly maestros = inject(MaestroService);
  private readonly materias = inject(MateriaService);
  private readonly calificaciones = inject(CalificacionService);
  private readonly asistencias = inject(AsistenciaService);

  protected readonly nombre = this.auth.nombre;
  protected readonly rol = this.auth.rol;

  protected readonly esAlumno = computed(() => this.rol() === 'ALUMNO');
  protected readonly esMaestroOAdmin = computed(() =>
    ['ADMIN', 'MAESTRO'].includes(this.rol() ?? ''),
  );

  protected readonly accesos = computed(() =>
    menuPara(this.rol()).filter((elemento) => elemento.ruta !== '/'),
  );

  /** Total de alumnos (solo ADMIN y MAESTRO; ALUMNO recibiría 403). */
  private readonly recursoAlumnos = rxResource({
    params: () => (this.esMaestroOAdmin() ? true : undefined),
    stream: () => this.alumnos.listar({ size: 1 }),
  });

  /** Total de maestros (solo ADMIN y MAESTRO; ALUMNO recibiría 403). */
  private readonly recursoMaestros = rxResource({
    params: () => (this.esMaestroOAdmin() ? true : undefined),
    stream: () => this.maestros.listar({ size: 1 }),
  });

  /** Total de materias (ADMIN, MAESTRO y ALUMNO). */
  private readonly recursoMaterias = rxResource({
    params: () => true,
    stream: () => this.materias.listar({ size: 1 }),
  });

  /** Tope del eje de promedios: sin él, un 6 de 10 saldría como barra llena. */
  protected readonly notaMaxima = NOTA_MAXIMA;

  /**
   * Todas las notas que alimentan las gráficas del ADMIN y el MAESTRO.
   *
   * Pide la primera página de materias y luego las notas de cada una, en
   * paralelo con `forkJoin`. Es una petición por materia porque no hay otra
   * forma con esta API — ver `MATERIAS_EN_LAS_GRAFICAS`.
   *
   * Una materia sin calificar responde con un arreglo vacío, no con un error, de
   * modo que no hace falta tratarla aparte: se cae sola de las barras.
   */
  private readonly recursoNotasDelCentro = rxResource({
    params: () => (this.esMaestroOAdmin() ? true : undefined),
    stream: (): Observable<Calificacion[]> =>
      this.materias.listar({ size: MATERIAS_EN_LAS_GRAFICAS }).pipe(
        switchMap((pagina) =>
          pagina.content.length === 0
            ? of<Calificacion[][]>([])
            : forkJoin(
                pagina.content.map((materia) => this.calificaciones.listarPorMateria(materia.id)),
              ),
        ),
        map((porMateria) => porMateria.flat()),
      ),
  });

  /**
   * El id del propio alumno, que el token no trae: lleva email y rol.
   *
   * Es el mismo rodeo de las pantallas de los Días 21 y 24 — las consultas se
   * piden por id, así que primero hay que preguntar cuál es el de uno.
   */
  private readonly recursoMiFicha = rxResource({
    params: () => (this.esAlumno() ? true : undefined),
    stream: () => this.alumnos.obtenerActual(),
  });

  private readonly miId = computed(() =>
    this.recursoMiFicha.hasValue() ? this.recursoMiFicha.value().id : null,
  );

  private readonly recursoMisNotas = rxResource({
    params: () => this.miId() ?? undefined,
    stream: ({ params: id }) => this.calificaciones.listarPorAlumno(id),
  });

  private readonly recursoMiAsistencia = rxResource({
    params: () => this.miId() ?? undefined,
    stream: ({ params: id }) => this.asistencias.listarPorAlumno(id),
  });

  /** Las notas que le tocan a quien está mirando: las del centro o las suyas. */
  private readonly notas = computed<Calificacion[]>(() => {
    const recurso = this.esAlumno() ? this.recursoMisNotas : this.recursoNotasDelCentro;
    return recurso.hasValue() ? recurso.value() : [];
  });

  protected readonly barrasDePromedio = computed(() => promedioPorMateria(this.notas()));

  protected readonly barrasDeDistribucion = computed(() => distribucionDeNotas(this.notas()));

  protected readonly barrasDeMiAsistencia = computed(() =>
    barrasDeAsistencia(this.recursoMiAsistencia.hasValue() ? this.recursoMiAsistencia.value() : []),
  );

  protected readonly miAsistencia = computed(() =>
    resumenDeAsistencia(
      this.recursoMiAsistencia.hasValue() ? this.recursoMiAsistencia.value() : [],
    ),
  );

  /** Promedio general de lo graficado. `null` cuando todavía no hay notas. */
  protected readonly promedioGeneral = computed(() =>
    promedio(this.notas().map((nota) => nota.calificacion)),
  );

  /** Cuántas notas respaldan las gráficas, para que la cifra no salga a ciegas. */
  protected readonly notasContadas = computed(() => this.notas().length);

  protected readonly cargandoGraficas = computed(() =>
    this.esAlumno()
      ? this.recursoMiFicha.isLoading() ||
        this.recursoMisNotas.isLoading() ||
        this.recursoMiAsistencia.isLoading()
      : this.recursoNotasDelCentro.isLoading(),
  );

  /**
   * Fallo de las gráficas, separado del de las tarjetas.
   *
   * Van aparte porque son peticiones distintas: que no carguen los promedios no
   * tiene por qué borrar unos conteos que sí llegaron, ni al revés.
   */
  protected readonly errorGraficas = computed(() => {
    const fallo = this.esAlumno()
      ? (this.recursoMiFicha.error() ??
        this.recursoMisNotas.error() ??
        this.recursoMiAsistencia.error())
      : this.recursoNotasDelCentro.error();
    return fallo === undefined || fallo === null
      ? null
      : mensajeDeError(fallo, 'No se pudieron cargar las gráficas.');
  });

  protected readonly totalAlumnos = computed(() =>
    this.recursoAlumnos.hasValue() ? this.recursoAlumnos.value().totalElements : null,
  );

  protected readonly totalMaestros = computed(() =>
    this.recursoMaestros.hasValue() ? this.recursoMaestros.value().totalElements : null,
  );

  protected readonly totalMaterias = computed(() =>
    this.recursoMaterias.hasValue() ? this.recursoMaterias.value().totalElements : null,
  );

  protected readonly cargando = computed(
    () =>
      (this.esMaestroOAdmin() &&
        (this.recursoAlumnos.isLoading() || this.recursoMaestros.isLoading())) ||
      this.recursoMaterias.isLoading(),
  );

  protected readonly errorCarga = computed(() => {
    const fallo =
      (this.esMaestroOAdmin()
        ? (this.recursoAlumnos.error() ?? this.recursoMaestros.error())
        : null) ?? this.recursoMaterias.error();
    return fallo === undefined || fallo === null
      ? null
      : mensajeDeError(fallo, 'No se pudieron cargar los conteos del sistema.');
  });
}
