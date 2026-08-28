import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import { AlumnoService } from '../../core/services/alumno-service';
import { AuthService } from '../../core/services/auth-service';
import { Avisos } from '../../core/services/avisos';
import { mensajeDeError } from '../../core/services/mensaje-error';
import { ReporteService } from '../../core/services/reporte-service';

const ALUMNOS_EN_EL_SELECTOR = 100;

/**
 * Módulo de Reportes: descarga de boleta de calificaciones en formato PDF.
 *
 * Permite a los alumnos descargar su propia boleta en PDF y a los administradores
 * o maestros seleccionar a cualquier alumno para descargar su boleta.
 */
@Component({
  selector: 'app-reportes',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './reportes.html',
  styleUrl: './reportes.scss',
})
export class Reportes {
  private readonly reportes = inject(ReporteService);
  private readonly alumnos = inject(AlumnoService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);

  protected readonly esAlumno = computed(() => this.auth.rol() === 'ALUMNO');

  protected readonly alumnoElegido = signal<number | null>(null);
  protected readonly descargando = signal(false);

  /** Datos del alumno logueado si es un ALUMNO. */
  private readonly alumnoActual = rxResource({
    params: () => (this.esAlumno() ? true : undefined),
    stream: () => this.alumnos.obtenerActual(),
  });

  /** Listado de alumnos para el selector (ADMIN y MAESTRO). */
  private readonly paginaDeAlumnos = rxResource({
    params: () => (this.esAlumno() ? undefined : true),
    stream: () => this.alumnos.listar({ size: ALUMNOS_EN_EL_SELECTOR, sort: 'apellido,asc' }),
  });

  protected readonly miAlumno = computed(() =>
    this.alumnoActual.hasValue() ? this.alumnoActual.value() : undefined,
  );

  protected readonly opcionesDeAlumno = computed(() =>
    this.paginaDeAlumnos.hasValue() ? this.paginaDeAlumnos.value().content : [],
  );

  protected readonly cargando = computed(
    () => this.alumnoActual.isLoading() || this.paginaDeAlumnos.isLoading(),
  );

  protected readonly errorCarga = computed(() => {
    const fallo = this.alumnoActual.error() ?? this.paginaDeAlumnos.error();
    return fallo === undefined
      ? null
      : mensajeDeError(fallo, 'No se pudo cargar la información de reportes.');
  });

  protected descargarBoleta(alumnoId: number): void {
    if (this.descargando()) {
      return;
    }
    this.descargando.set(true);
    this.reportes.descargarBoleta(alumnoId).subscribe({
      next: (nombreArchivo) => {
        this.descargando.set(false);
        this.avisos.exito(`Boleta descargada: ${nombreArchivo}`);
      },
      error: (err) => {
        this.descargando.set(false);
        this.avisos.error(mensajeDeError(err, 'No se pudo descargar la boleta en PDF.'));
      },
    });
  }

  protected descargarMiBoleta(): void {
    const alumno = this.miAlumno();
    if (alumno) {
      this.descargarBoleta(alumno.id);
    }
  }

  protected descargarBoletaSeleccionada(): void {
    const id = this.alumnoElegido();
    if (id) {
      this.descargarBoleta(id);
    }
  }
}
