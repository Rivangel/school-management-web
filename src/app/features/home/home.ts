import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { menuPara } from '../../core/navegacion';
import { AlumnoService } from '../../core/services/alumno-service';
import { AuthService } from '../../core/services/auth-service';
import { MaestroService } from '../../core/services/maestro-service';
import { MateriaService } from '../../core/services/materia-service';
import { mensajeDeError } from '../../core/services/mensaje-error';

/**
 * Portada y Dashboard de la aplicación, dentro del shell.
 *
 * Muestra tarjetas con conteos estadísticos resumen (alumnos, maestros, materias)
 * para administradores y maestros, y métricas/accesos relevantes para alumnos.
 */
@Component({
  selector: 'app-home',
  imports: [MatCardModule, MatIconModule, MatProgressBarModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly alumnos = inject(AlumnoService);
  private readonly maestros = inject(MaestroService);
  private readonly materias = inject(MateriaService);

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
