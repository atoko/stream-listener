import { app, BrowserWindow } from "electron";
import { getPortPromise } from "portfinder";
import path from "node:path";
import started from "electron-squirrel-startup";
import { exec } from "node:child_process";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let serverPort: number | undefined;
const startServer = async () => {
  return new Promise<void>((resolve, reject) => {
    getPortPromise().then((port) => {
      serverPort = port;

      exec(
        `node ${path.join(
          // process.resourcesPath,
          // "app.asar",
          // `hear-stream-module`,
          `${process.cwd()}`, //
          "..", //
          "..", //
          "module", //
          "main.mjs"
        )}`,
        {
          cwd: path.join(process.resourcesPath),
          env: {
            SERVER_PORT: String(port),
            NODE_OPTIONS: "--experimental-vm-modules",
          },
        },
        (error, stdout, stderr) => {
          console.error(error);
          if (error) {
            throw error;
          }
          resolve();
        }
      );
    });
  });
};
const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Load server debug
  // mainWindow.loadURL(`http://localhost:${port}/configure`);

  // and load the index.html of the app-vite.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  setTimeout(() => {
    mainWindow.webContents.send("app-port", serverPort);
  }, 1500);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  startServer().then(() => {
    createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app-vite when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app-vite's specific main process
// code. You can also put them in separate files and import them here.
