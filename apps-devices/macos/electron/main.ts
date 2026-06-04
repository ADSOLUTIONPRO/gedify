/**
 * Process principal Electron de Gedify macOS.
 *
 * Routage selon le mode configuré :
 *  - remote_gedify  → charge l'URL du serveur Gedify (ex. https://doc.azserver.fr)
 *  - local_gedify / local_full → ouvre l'écran de gestion locale (status/diagnostics)
 *    (le runtime Gedify local embarqué arrivera dans une version ultérieure).
 *
 * Sécurité : la fenêtre « app » qui charge un site distant N'EXPOSE PAS le pont
 * privilégié (window.gedify). Seules les fenêtres locales (onboarding/réglages)
 * y ont accès.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import * as path from "node:path";
import {
  ensureDirs, getSecret, readConfig, rootDir, setSecret, writeConfig,
  type GedifyConfig, type GedifyRuntimeMode, type PaperlessMode,
} from "./config";
import { testConnection, type ConnectionTestInput } from "./connection-test";
import { checkDocker, fetchPaperlessToken, localStack } from "./local-stack";
import { runtimeAvailable, startGedifyRuntime, stopGedifyRuntime } from "./gedify-runtime";
import { createBackup, restoreBackup } from "./backup";
import { autoInstallDocker, detectMac, dockerChoice } from "./docker-install";

const LOCAL_PORT = 3120;

let win: BrowserWindow | null = null;

function rendererFile(rel: string): string {
  return path.join(app.getAppPath(), "renderer", rel);
}

function destroyWin() {
  if (win && !win.isDestroyed()) win.destroy();
  win = null;
}

/** Fenêtre locale (onboarding / réglages) AVEC le pont privilégié. */
function openConfigWindow(page: "onboarding" | "settings") {
  destroyWin();
  win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#F7F4EE",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void win.loadFile(rendererFile(`${page}/index.html`));
}

/** Ajoute le schéma s'il manque (https par défaut, http en local) + retire le / final. */
export function normalizeUrl(input?: string): string | undefined {
  if (!input) return undefined;
  let u = input.trim();
  if (!u) return undefined;
  if (!/^https?:\/\//i.test(u)) {
    const isLocal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i.test(u);
    u = (isLocal ? "http://" : "https://") + u;
  }
  return u.replace(/\/+$/, "");
}

function errorPage(url: string, desc: string, code: number): string {
  return "data:text/html;charset=utf-8," + encodeURIComponent(
    `<!doctype html><meta charset="utf-8"><body style="font-family:-apple-system,Inter,sans-serif;margin:0;padding:48px;background:#F7F4EE;color:#14233C">
     <h2 style="margin:0 0 8px">Impossible de charger Gedify</h2>
     <p style="color:#5F6B7A;margin:0 0 16px">URL : <b>${url}</b></p>
     <p style="background:#FDECEC;color:#B91C1C;padding:10px 12px;border-radius:10px;font-weight:600">${desc} (${code})</p>
     <p style="color:#5F6B7A">Vérifie l'URL (avec <b>https://</b>) et ta connexion, puis menu <b>Gedify → Changer de mode / serveur</b> pour la corriger.</p>
     </body>`);
}

/** Fenêtre « application » qui charge un site distant, SANS pont privilégié. */
function openAppWindow(rawUrl: string) {
  const url = normalizeUrl(rawUrl) ?? rawUrl;
  destroyWin();
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: true,
    titleBarStyle: "hiddenInset",
    // Boutons fermer/réduire/agrandir centrés dans la barre de titre bleu nuit (34px).
    trafficLightPosition: { x: 14, y: 10 },
    backgroundColor: "#14233C",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  // UA marqué « GedifyDesktop » : la web-app détecte le bureau et affiche la barre
  // de titre bleu nuit déplaçable (cf. AppShell). setUserAgent persiste sur toutes
  // les navigations de cette fenêtre.
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} GedifyDesktop/1.0`);
  // Échec de chargement (URL invalide, serveur injoignable, certificat…) → page d'erreur lisible.
  win.webContents.on("did-fail-load", (_e, code, desc, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3 /* ERR_ABORTED (redirections normales) */) return;
    console.error(`[openAppWindow] échec ${code} ${desc} sur ${validatedURL || url}`);
    void win?.loadURL(errorPage(url, desc || "Échec de chargement", code));
  });
  console.log(`[openAppWindow] chargement de ${url}`);
  void win.loadURL(url);
  // Liens externes → navigateur système.
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    void shell.openExternal(u);
    return { action: "deny" };
  });
}

/** Applique le mode configuré : choisit la bonne fenêtre. */
async function routeByConfig() {
  const cfg = await readConfig();
  if (!cfg.configured || !cfg.runtimeMode) return openConfigWindow("onboarding");
  if (cfg.runtimeMode === "remote_gedify" && cfg.gedifyServerUrl) return openAppWindow(cfg.gedifyServerUrl);
  if (cfg.runtimeMode === "local_full" || cfg.runtimeMode === "local_gedify") {
    // Démarre le moteur Gedify local embarqué (Next.js standalone) puis l'ouvre.
    if (runtimeAvailable() && cfg.paperlessUrl) {
      try {
        await startGedifyRuntime({ port: LOCAL_PORT, paperlessUrl: cfg.paperlessUrl });
        return openAppWindow(`http://localhost:${LOCAL_PORT}`);
      } catch (e) {
        console.error("[runtime] démarrage échoué :", e instanceof Error ? e.message : e);
        return openConfigWindow("settings");
      }
    }
    // Moteur non bundlé (ex. dev sans build-runtime.sh) → écran de gestion.
    return openConfigWindow("settings");
  }
  return openConfigWindow("onboarding");
}

/* ── IPC ─────────────────────────────────────────────────────────────────── */

type SavePayload = Partial<GedifyConfig> & {
  runtimeMode: GedifyRuntimeMode;
  paperlessMode?: PaperlessMode;
  gedifyToken?: string | null;
  paperlessToken?: string | null;
};

function registerIpc() {
  ipcMain.handle("config:get", async () => readConfig());

  ipcMain.handle("config:save", async (_e, payload: SavePayload) => {
    await ensureDirs();
    if (payload.gedifyToken !== undefined) await setSecret("gedify_token", payload.gedifyToken);
    if (payload.paperlessToken !== undefined) await setSecret("paperless_token", payload.paperlessToken);
    const cfg: GedifyConfig = {
      configured: true,
      runtimeMode: payload.runtimeMode,
      paperlessMode: payload.paperlessMode ?? "not_configured",
      gedifyServerUrl: normalizeUrl(payload.gedifyServerUrl),
      gedifyLocalUrl: normalizeUrl(payload.gedifyLocalUrl),
      paperlessUrl: normalizeUrl(payload.paperlessUrl),
      localDataDir: payload.localDataDir ?? path.join(rootDir(), "data"),
      spaceName: payload.spaceName,
      configuredAt: new Date().toISOString().slice(0, 10),
      hasGedifyToken: Boolean(payload.gedifyToken),
      hasPaperlessToken: Boolean(payload.paperlessToken),
    };
    await writeConfig(cfg);
    return { ok: true, config: cfg };
  });

  ipcMain.handle("config:reset", async () => {
    await writeConfig({ configured: false, runtimeMode: null, paperlessMode: "not_configured" });
    await setSecret("gedify_token", null);
    await setSecret("paperless_token", null);
    openConfigWindow("onboarding");
    return { ok: true };
  });

  ipcMain.handle("connection:test", async (_e, input: ConnectionTestInput) => {
    // Si aucun token fourni, on tente avec le token déjà enregistré.
    const paperlessToken = input.paperlessToken ?? (await getSecret("paperless_token")) ?? undefined;
    return testConnection({ ...input, paperlessToken });
  });

  ipcMain.handle("app:enter", () => routeByConfig());

  ipcMain.handle("shell:openExternal", (_e, url: string) => shell.openExternal(url));
  ipcMain.handle("shell:openDataDir", () => shell.openPath(rootDir()));
  ipcMain.handle("dialog:chooseDir", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"], defaultPath: rootDir() });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle("backup:create", async () => {
    const r = await dialog.showSaveDialog({
      title: "Sauvegarder les données Gedify",
      defaultPath: path.join(app.getPath("downloads"), `gedify-sauvegarde-${new Date().toISOString().slice(0, 10)}.zip`),
    });
    if (r.canceled || !r.filePath) return { ok: false, message: "Annulé." };
    return createBackup(r.filePath);
  });
  ipcMain.handle("backup:restore", async () => {
    const r = await dialog.showOpenDialog({
      title: "Restaurer une sauvegarde Gedify",
      properties: ["openFile"],
      filters: [{ name: "Sauvegarde Gedify", extensions: ["zip"] }],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, message: "Annulé." };
    return restoreBackup(r.filePaths[0]);
  });

  ipcMain.handle("docker:check", () => checkDocker());
  ipcMain.handle("docker:detect", async () => {
    const info = await detectMac();
    return { ...info, choice: dockerChoice(info) };
  });
  ipcMain.handle("docker:autoInstall", () => autoInstallDocker());
  ipcMain.handle("localstack:install", () => localStack.install());
  ipcMain.handle("localstack:start", () => localStack.start());
  ipcMain.handle("localstack:stop", () => localStack.stop());
  ipcMain.handle("localstack:reset", () => localStack.reset());
  ipcMain.handle("localstack:status", () => localStack.status());
  ipcMain.handle("localstack:token", async () => {
    const r = await fetchPaperlessToken(8010);
    if (r.ok && r.token) await setSecret("paperless_token", r.token);
    return r;
  });
}

/* ── Menu natif ──────────────────────────────────────────────────────────── */

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about", label: "À propos de Gedify" },
        { type: "separator" },
        { label: "Réglages / Diagnostics…", accelerator: "Cmd+,", click: () => openConfigWindow("settings") },
        { label: "Changer de mode / serveur…", click: () => openConfigWindow("onboarding") },
        { type: "separator" },
        { role: "hide", label: "Masquer Gedify" },
        { role: "quit", label: "Quitter Gedify" },
      ],
    },
    { role: "editMenu", label: "Édition" },
    {
      label: "Affichage",
      submenu: [
        { role: "reload", label: "Recharger" },
        { role: "toggleDevTools", label: "Outils de développement" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" },
      ],
    },
    { role: "windowMenu", label: "Fenêtre" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ── Cycle de vie ────────────────────────────────────────────────────────── */

app.whenReady().then(async () => {
  await ensureDirs();
  registerIpc();
  buildMenu();
  await routeByConfig();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void routeByConfig();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => stopGedifyRuntime());
