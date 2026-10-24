const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

let crashWindow = null;

function saveCrashLog(info) {
  try {
    const dir = path.join(app.getPath('userData'), 'crash-reports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `crash-${timestamp}.log`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, info, 'utf8');
    return filepath;
  } catch (err) {
    console.error('Failed to write crash log:', err);
    return null;
  }
}

function formatDiagnosticReport(errorTitle, errorDetails) {
  const stack = errorDetails?.stack || errorDetails?.message || String(errorDetails || 'Unknown error');
  return [
    '=======================================================',
    '             BLACKOUT BROWSER CRASH REPORT             ',
    '=======================================================',
    `Timestamp: ${new Date().toISOString()}`,
    `App Version: ${app.getVersion()}`,
    `Operating System: ${process.platform} (${os.release()}) ${os.arch()}`,
    `Node Version: ${process.versions.node}`,
    `Electron Version: ${process.versions.electron}`,
    `Chrome Version: ${process.versions.chrome}`,
    `Total Memory: ${Math.round(os.totalmem() / 1024 / 1024)} MB`,
    `Free Memory: ${Math.round(os.freemem() / 1024 / 1024)} MB`,
    `Crash Reason: ${errorTitle}`,
    '-------------------------------------------------------',
    'STACK TRACE / DIAGNOSTIC DETAILS:',
    stack,
    '======================================================='
  ].join('\n');
}

function showCrashReportWindow(errorTitle, errorDetails) {
  try {
    if (crashWindow && !crashWindow.isDestroyed()) {
      crashWindow.focus();
      return;
    }

    const reportText = formatDiagnosticReport(errorTitle, errorDetails);
    const logFile = saveCrashLog(reportText);

    global.__latestCrashData = {
      title: errorTitle,
      details: errorDetails?.message || String(errorDetails || 'Unknown error'),
      report: reportText,
      logFile,
      supportEmail: 'support@pactuno.online'
    };

    crashWindow = new BrowserWindow({
      width: 720,
      height: 560,
      minWidth: 640,
      minHeight: 480,
      center: true,
      resizable: true,
      frame: false,
      backgroundColor: '#090a11',
      title: 'Blackout Browser — Crash Report',
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload-crash.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    crashWindow.loadFile(path.join(__dirname, '..', 'ui', 'crash-report.html'));

    crashWindow.on('closed', () => {
      crashWindow = null;
    });
  } catch (e) {
    console.error('Fatal: Could not open crash reporter window:', e);
  }
}

function initCrashReporter() {
  ipcMain.handle('crash:get-data', () => {
    return global.__latestCrashData || {
      title: 'Unexpected Crash',
      details: 'Unknown error',
      report: 'No diagnostics recorded.',
      supportEmail: 'support@pactuno.online'
    };
  });

  ipcMain.handle('crash:send-email', async (_event, mailto) => {
    try {
      await shell.openExternal(mailto);
      return true;
    } catch (err) {
      console.error('Failed to open email client:', err);
      return false;
    }
  });

  ipcMain.handle('crash:copy-report', (_event, text) => {
    clipboard.writeText(text || '');
    return true;
  });

  ipcMain.handle('crash:restart', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('crash:close', () => {
    if (crashWindow && !crashWindow.isDestroyed()) {
      crashWindow.close();
    }
  });

  ipcMain.handle('browser:report-crash', (_event, crashData) => {
    showCrashReportWindow(crashData?.title || 'Renderer Error', crashData);
    return true;
  });

  process.on('uncaughtException', (err) => {
    console.error('CRASH [uncaughtException]:', err);
    showCrashReportWindow('Uncaught Main Process Exception', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('CRASH [unhandledRejection]:', reason);
    showCrashReportWindow('Unhandled Promise Rejection', reason);
  });
}

module.exports = {
  initCrashReporter,
  showCrashReportWindow
};
