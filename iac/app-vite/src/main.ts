import { app, BrowserWindow } from 'electron';
import { getPortPromise } from "portfinder";
import path from 'node:path';
import started from 'electron-squirrel-startup';
import pm2 from "pm2";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const startServer = async () => {
  return new Promise<number>((resolve, reject) => {
    pm2.connect(() => {
      getPortPromise().then((port) => {
        pm2.start({
              script: path.join(process.cwd(), '..', '..', 'module', 'main.mjs'),
              env: {
                SERVER_PORT: String(port)
              },
            },
            function (err, apps) {
              console.log({
                apps
              });
              if (err) {
                console.error(err)
                pm2.disconnect()
                return reject(err)
              }

              resolve(port);
            });
      });
    });
  })
}

const createWindow = (port: number) => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app-vite.
  mainWindow.loadURL(`http://localhost:${port}/configure`);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

let port: number | undefined;
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  startServer().then((serverPort) => {
    createWindow(serverPort);
    port = serverPort;
  })
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  pm2.stop("all", () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app-vite when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(port);
  }
});

// In this file you can include the rest of your app-vite's specific main process
// code. You can also put them in separate files and import them here.
