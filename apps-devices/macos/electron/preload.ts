/**
 * Pont sécurisé renderer ↔ main (contextIsolation activé, nodeIntegration désactivé).
 * Seules les méthodes exposées ici sont accessibles depuis l'UI (window.gedify).
 */
import { contextBridge, ipcRenderer } from "electron";

const api = {
  getConfig: () => ipcRenderer.invoke("config:get"),
  /** Enregistre la config + secrets. Le main applique le mode (charge le serveur, etc.). */
  saveConfig: (payload: unknown) => ipcRenderer.invoke("config:save", payload),
  resetConfig: () => ipcRenderer.invoke("config:reset"),
  testConnection: (payload: unknown) => ipcRenderer.invoke("connection:test", payload),
  openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
  chooseDirectory: () => ipcRenderer.invoke("dialog:chooseDir"),
  openDataDir: () => ipcRenderer.invoke("shell:openDataDir"),
  backupCreate: () => ipcRenderer.invoke("backup:create"),
  backupRestore: () => ipcRenderer.invoke("backup:restore"),
  /** Démarre l'app dans le mode configuré (ferme l'onboarding). */
  enterApp: () => ipcRenderer.invoke("app:enter"),
  // Stack Paperless local
  docker: {
    check: () => ipcRenderer.invoke("docker:check"),
    detect: () => ipcRenderer.invoke("docker:detect"),
    autoInstall: () => ipcRenderer.invoke("docker:autoInstall"),
  },
  localStack: {
    install: () => ipcRenderer.invoke("localstack:install"),
    start: () => ipcRenderer.invoke("localstack:start"),
    stop: () => ipcRenderer.invoke("localstack:stop"),
    reset: () => ipcRenderer.invoke("localstack:reset"),
    status: () => ipcRenderer.invoke("localstack:status"),
    token: () => ipcRenderer.invoke("localstack:token"),
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld("gedify", api);

export type GedifyBridge = typeof api;
