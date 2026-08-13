import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';
import { invitadoGuard } from './core/guards/invitado-guard';
import { rolGuard } from './core/guards/rol-guard';
import { rolesDe } from './core/navegacion';

const titulo = (seccion: string) => `${seccion} · School Management`;

/** Pantalla provisional de las secciones que aún no existen (ver `Proximamente`). */
const proximamente = () =>
  import('./shared/components/proximamente/proximamente').then((m) => m.Proximamente);

export const routes: Routes = [
  {
    path: 'login',
    title: titulo('Iniciar sesión'),
    canActivate: [invitadoGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'acceso-denegado',
    title: titulo('Acceso denegado'),
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
        title: titulo('Inicio'),
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'alumnos',
        title: titulo('Alumnos'),
        canActivate: [rolGuard(...rolesDe('/alumnos'))],
        loadComponent: () =>
          import('./features/alumnos/lista-alumnos/lista-alumnos').then((m) => m.ListaAlumnos),
      },
      {
        path: 'maestros',
        title: titulo('Maestros'),
        canActivate: [rolGuard(...rolesDe('/maestros'))],
        data: { titulo: 'Maestros', dia: 16 },
        loadComponent: proximamente,
      },
      {
        path: 'materias',
        title: titulo('Materias'),
        canActivate: [rolGuard(...rolesDe('/materias'))],
        data: { titulo: 'Materias', dia: 18 },
        loadComponent: proximamente,
      },
      {
        path: 'calificaciones',
        title: titulo('Calificaciones'),
        canActivate: [rolGuard(...rolesDe('/calificaciones'))],
        data: { titulo: 'Calificaciones', dia: 20 },
        loadComponent: proximamente,
      },
      {
        path: 'asistencia',
        title: titulo('Asistencia'),
        canActivate: [rolGuard(...rolesDe('/asistencia'))],
        data: { titulo: 'Asistencia', dia: 23 },
        loadComponent: proximamente,
      },
      {
        path: 'reportes',
        title: titulo('Reportes'),
        canActivate: [rolGuard(...rolesDe('/reportes'))],
        data: { titulo: 'Reportes', dia: 25 },
        loadComponent: proximamente,
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
