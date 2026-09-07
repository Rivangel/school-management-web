import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';
import { invitadoGuard } from './core/guards/invitado-guard';
import { rolGuard } from './core/guards/rol-guard';
import { t } from './core/i18n/traducir';
import {
  ROLES_ESCRITURA,
  ROLES_NOTAS_DE_MATERIA,
  ROLES_REGISTRO,
  rolesDe,
} from './core/navegacion';

/**
 * El título de la pestaña, en el idioma activo **al navegar**.
 *
 * Devuelve una función y no una cadena para que `t()` se lea de nuevo en cada
 * navegación — una cadena calculada una sola vez al construir las rutas se
 * quedaría fija en el idioma que estuviera activo entonces.
 */
const tituloDe = (clave: string) => () => `${t(clave)} · ${t('shell.marca')}`;

/** Alta y edición comparten componente: el modo lo decide el `id` de la ruta. */
const formularioDeAlumno = () =>
  import('./features/alumnos/formulario-alumno/formulario-alumno').then((m) => m.FormularioAlumno);

/** Igual que el de alumnos: el modo lo decide el `id` de la ruta. */
const formularioDeMaestro = () =>
  import('./features/maestros/formulario-maestro/formulario-maestro').then(
    (m) => m.FormularioMaestro,
  );

/** Igual que los otros dos: el modo lo decide el `id` de la ruta. */
const formularioDeMateria = () =>
  import('./features/materias/formulario-materia/formulario-materia').then(
    (m) => m.FormularioMateria,
  );

export const routes: Routes = [
  {
    path: 'login',
    title: tituloDe('login.titulo'),
    canActivate: [invitadoGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'acceso-denegado',
    title: tituloDe('accesoDenegado.titulo'),
    loadComponent: () =>
      import('./features/errores/acceso-denegado/acceso-denegado').then((m) => m.AccesoDenegado),
  },
  {
    // El shell es el componente de la ruta padre, así que la barra y el menú se
    // montan una sola vez: al navegar entre secciones sólo cambia el contenido
    // del `router-outlet` interno.
    //
    // Va con `loadComponent` (no `component`) para que sus módulos de Material no
    // entren en el bundle inicial: la primera pantalla que ve cualquiera es el
    // login, que no necesita nada de esto.
    path: '',
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: tituloDe('shell.menu.Inicio'),
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'alumnos',
        title: tituloDe('alumnos.lista.titulo'),
        canActivate: [rolGuard(...rolesDe('/alumnos'))],
        loadComponent: () =>
          import('./features/alumnos/lista-alumnos/lista-alumnos').then((m) => m.ListaAlumnos),
      },
      {
        // Las escrituras son sólo del ADMIN, así que estas dos rutas no heredan
        // los roles de la sección: los toman de `ROLES_ESCRITURA`, la misma
        // lista que decide si el listado enseña los botones que traen aquí.
        path: 'alumnos/nuevo',
        title: tituloDe('alumnos.formulario.tituloNuevo'),
        canActivate: [rolGuard(...ROLES_ESCRITURA)],
        loadComponent: formularioDeAlumno,
      },
      {
        // Después de `alumnos/nuevo`: el router prueba en orden y `:id` se
        // tragaría "nuevo" como si fuera un identificador.
        path: 'alumnos/:id',
        title: tituloDe('alumnos.detalle.titulo'),
        canActivate: [rolGuard(...rolesDe('/alumnos'))],
        loadComponent: () =>
          import('./features/alumnos/detalle-alumno/detalle-alumno').then((m) => m.DetalleAlumno),
      },
      {
        path: 'alumnos/:id/editar',
        title: tituloDe('alumnos.formulario.tituloEditar'),
        canActivate: [rolGuard(...ROLES_ESCRITURA)],
        loadComponent: formularioDeAlumno,
      },
      {
        path: 'maestros',
        title: tituloDe('maestros.lista.titulo'),
        canActivate: [rolGuard(...rolesDe('/maestros'))],
        loadComponent: () =>
          import('./features/maestros/lista-maestros/lista-maestros').then((m) => m.ListaMaestros),
      },
      {
        // Las escrituras son del ADMIN, aunque el listado lo vea también el
        // MAESTRO: `ROLES_ESCRITURA` es la lista que leen a la vez el botón que
        // trae aquí y este guard.
        path: 'maestros/nuevo',
        title: tituloDe('maestros.formulario.tituloNuevo'),
        canActivate: [rolGuard(...ROLES_ESCRITURA)],
        loadComponent: formularioDeMaestro,
      },
      {
        // Después de `maestros/nuevo`: el router prueba en orden y `:id` se
        // tragaría "nuevo" como si fuera un identificador.
        path: 'maestros/:id',
        title: tituloDe('maestros.detalle.titulo'),
        canActivate: [rolGuard(...rolesDe('/maestros'))],
        loadComponent: () =>
          import('./features/maestros/detalle-maestro/detalle-maestro').then(
            (m) => m.DetalleMaestro,
          ),
      },
      {
        path: 'maestros/:id/editar',
        title: tituloDe('maestros.formulario.tituloEditar'),
        canActivate: [rolGuard(...ROLES_ESCRITURA)],
        loadComponent: formularioDeMaestro,
      },
      {
        path: 'materias',
        title: tituloDe('materias.lista.titulo'),
        canActivate: [rolGuard(...rolesDe('/materias'))],
        loadComponent: () =>
          import('./features/materias/lista-materias/lista-materias').then((m) => m.ListaMaterias),
      },
      {
        // El listado de materias lo ve todo el mundo, incluido el ALUMNO, pero
        // las escrituras siguen siendo del ADMIN: `ROLES_ESCRITURA` otra vez.
        //
        // La ruta es `nueva` y no `nuevo` porque la materia es femenina, y por
        // lo mismo que en las otras dos secciones va **antes** que `:id`: el
        // router prueba en orden y se la tragaría como un identificador.
        path: 'materias/nueva',
        title: tituloDe('materias.formulario.tituloNuevo'),
        canActivate: [rolGuard(...ROLES_ESCRITURA)],
        loadComponent: formularioDeMateria,
      },
      {
        // Después de `materias/nueva`, por lo mismo de siempre: el router prueba
        // en orden y `:id` se la tragaría como un identificador.
        path: 'materias/:id',
        title: tituloDe('materias.detalle.titulo'),
        canActivate: [rolGuard(...rolesDe('/materias'))],
        loadComponent: () =>
          import('./features/materias/detalle-materia/detalle-materia').then(
            (m) => m.DetalleMateria,
          ),
      },
      {
        path: 'materias/:id/editar',
        title: tituloDe('materias.formulario.tituloEditar'),
        canActivate: [rolGuard(...ROLES_ESCRITURA)],
        loadComponent: formularioDeMateria,
      },
      {
        path: 'calificaciones',
        title: tituloDe('calificaciones.alumno.titulo'),
        canActivate: [rolGuard(...rolesDe('/calificaciones'))],
        loadComponent: () =>
          import('./features/calificaciones/calificaciones-alumno/calificaciones-alumno').then(
            (m) => m.CalificacionesAlumno,
          ),
      },
      {
        // Ver de una sentada las notas de todo un grupo no es cosa del ALUMNO,
        // aunque la sección de calificaciones sí lo sea: vería las de sus
        // compañeros. Va antes de `registrar` por costumbre, no por necesidad —
        // son dos rutas literales y ninguna es un comodín.
        path: 'calificaciones/materia',
        title: tituloDe('calificaciones.materia.titulo'),
        canActivate: [rolGuard(...ROLES_NOTAS_DE_MATERIA)],
        loadComponent: () =>
          import('./features/calificaciones/calificaciones-materia/calificaciones-materia').then(
            (m) => m.CalificacionesMateria,
          ),
      },
      {
        // Registrar no es `ROLES_ESCRITURA`: la API abre este POST también al
        // MAESTRO, que es quien pone las notas. Que la materia sea suya lo
        // comprueba el servidor, materia a materia — un rol no puede decirlo.
        path: 'calificaciones/registrar',
        title: tituloDe('calificaciones.formulario.tituloRegistrar'),
        canActivate: [rolGuard(...ROLES_REGISTRO)],
        loadComponent: () =>
          import('./features/calificaciones/formulario-calificacion/formulario-calificacion').then(
            (m) => m.FormularioCalificacion,
          ),
      },
      {
        path: 'asistencia',
        title: tituloDe('asistencia.alumno.titulo'),
        canActivate: [rolGuard(...rolesDe('/asistencia'))],
        loadComponent: () =>
          import('./features/asistencia/asistencia-alumno/asistencia-alumno').then(
            (m) => m.AsistenciaAlumno,
          ),
      },
      {
        // Pasar lista escribe, así que es `ROLES_REGISTRO` y no los roles de la
        // sección: la consulta la ve también el ALUMNO, esto no.
        path: 'asistencia/registrar',
        title: tituloDe('asistencia.registro.titulo'),
        canActivate: [rolGuard(...ROLES_REGISTRO)],
        loadComponent: () =>
          import('./features/asistencia/registro-asistencia/registro-asistencia').then(
            (m) => m.RegistroAsistencia,
          ),
      },
      {
        path: 'reportes',
        title: tituloDe('reportes.titulo'),
        canActivate: [rolGuard(...rolesDe('/reportes'))],
        loadComponent: () =>
          import('./features/reportes/reportes').then((m) => m.Reportes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
