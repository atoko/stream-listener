/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
export interface IElectron {
    onPort: (callback: (port: number) => void) => void;
}

declare global {
    interface Window {
        electron: IElectron;
    }
}