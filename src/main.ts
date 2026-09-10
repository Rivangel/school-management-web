import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
// Efecto secundario: marca `data-tema` en <html> antes del primer pintado,
// para no arrancar en claro y parpadear a oscuro un instante después.
import './app/core/tema/estado';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
