import { app, BrowserWindow, utilityProcess } from "electron";
import { getPortPromise } from "portfinder";
import path from "node:path";
import started from "electron-squirrel-startup";
import { DataDirectory, InstallPlugins } from "./install/plugins";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let serverPort: number | undefined;
const startServer = async () => {
  const port = await getPortPromise();
  serverPort = port;

  let command: string;
  let cwd: string;
  let dataDirectory;

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    command = `${path.join(
      `${process.cwd()}`,
      "..",
      "..",
      "module",
      "src",
      "main.mjs"
    )}`;
    cwd = process.cwd();
    dataDirectory = `${path.join(`${process.cwd()}`, "..", "..")}`;
  } else {
    command = `${path.join(process.resourcesPath, "server.mjs")}`;
    dataDirectory = await InstallPlugins();
    cwd = path.join(dataDirectory);
  }

  try {
    console.log({
      command,
      cwd,
      dataDirectory,
    });
    const server = utilityProcess.fork(command, [], {
      cwd,
      env: {
        SERVER_PORT: String(port),
        NODE_OPTIONS: "--experimental-vm-modules",
        DATA_DIRECTORY: dataDirectory,
      },
    });

    server.on("exit", (code) => {
      app.quit();
    });
  } catch (error) {
    console.error(error);
    if (error) {
      throw error;
    }
  }
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
