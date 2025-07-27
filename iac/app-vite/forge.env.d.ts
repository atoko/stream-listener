/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
/// <reference types="vite/client" />
export interface IElectron {
    onPort: (callback: (port: number) => void) => void;
}

declare global {
    interface Window {
        electron: IElectron;
    }
}