import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApiRouter } from './api.mjs';
import {
  BACKUP_DIR,
  db,
  DB_PATH,
  createDailyBackupIfNeeded,
} from './database.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use('/api', createApiRouter());

if (existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).json({
      ok: true,
      message: 'API local de Billar Bar la Beta. En desarrollo abre la interfaz con Vite en el puerto 3000.',
    });
  });
}

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
});

function openBrowser(url) {
  if (process.env.OPEN_BROWSER !== '1') return;
  try {
    if (process.platform === 'win32') {
      const candidates = [
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ];
      const browser = candidates.find((candidate) => candidate && existsSync(candidate));
      if (browser) {
        spawn(browser, [`--app=${url}`, '--start-maximized'], {
          detached: true,
          stdio: 'ignore',
        }).unref();
        return;
      }
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
      return;
    }
    if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
      return;
    }
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch (error) {
    console.error('No se pudo abrir el navegador automáticamente:', error.message);
  }
}

const server = app.listen(port, host, () => {
  const url = `http://127.0.0.1:${port}`;
  console.log('');
  console.log('  BILLAR BAR LA BETA · CAJA LOCAL');
  console.log(`  Interfaz:      ${url}`);
  console.log(`  Base de datos: ${DB_PATH}`);
  console.log(`  Respaldos:     ${BACKUP_DIR}`);
  console.log('');
  console.log('  Deja esta ventana abierta mientras usas el sistema.');
  console.log('  Para detenerlo, cierra esta ventana o presiona Ctrl+C.');
  console.log('');

  try {
    const backup = createDailyBackupIfNeeded();
    if (backup) console.log(`  Respaldo automático: ${backup.name}`);
  } catch (error) {
    console.error('  No se pudo crear el respaldo automático:', error.message);
  }

  openBrowser(url);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nEl puerto ${port} ya está ocupado. Probablemente el sistema ya está abierto.\n`);
  } else {
    console.error('No se pudo iniciar el servidor:', error);
  }
  process.exitCode = 1;
});

const backupTimer = setInterval(() => {
  try {
    createDailyBackupIfNeeded();
  } catch (error) {
    console.error('No se pudo crear el respaldo diario:', error.message);
  }
}, 6 * 60 * 60 * 1000);
backupTimer.unref?.();

function shutdown(signal) {
  console.log(`\nCerrando el sistema (${signal})...`);
  server.close(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
