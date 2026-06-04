/* Réglages & diagnostics Gedify macOS. */
"use strict";
const g = window.gedify;
const $ = (id) => document.getElementById(id);
const LABELS = { remote_gedify: "Serveur Gedify existant", local_gedify: "Gedify local léger", local_full: "Gedify Local complète" };

async function render() {
  const c = await g.getConfig();
  const rows = [
    ["Mode", LABELS[c.runtimeMode] || "—"],
    ["Serveur Gedify", c.gedifyServerUrl || c.gedifyLocalUrl || "—"],
    ["Paperless", c.paperlessUrl || "—"],
    ["Données locales", c.localDataDir || "—"],
    ["Configuré le", c.configuredAt || "—"],
  ];
  $("cfg").innerHTML = rows.map(([k, v]) => `<div style="margin:3px 0"><b style="color:var(--text-main)">${k} :</b> ${v}</div>`).join("");
  const isLocalFull = c.runtimeMode === "local_full";
  $("local-block").classList.toggle("hidden", !isLocalFull);
  $("open-paperless").classList.toggle("hidden", !c.paperlessUrl || !/localhost|127\.0\.0\.1/.test(c.paperlessUrl || ""));
  if (isLocalFull) {
    const d = await g.docker.check();
    $("docker").innerHTML = `<span class="badge ${d.running ? "ok" : "err"}">${d.running ? "✓" : "✕"} ${d.message}</span>`;
  }
}

function logOut(r) { const el = $("ls-log"); el.classList.remove("hidden"); el.textContent = r.output || "(aucune sortie)"; el.scrollTop = el.scrollHeight; }

$("open-data").addEventListener("click", () => g.openDataDir());
$("open-paperless").addEventListener("click", async () => { const c = await g.getConfig(); g.openExternal(c.paperlessUrl || "http://localhost:8010"); });
$("open-app").addEventListener("click", () => g.enterApp());
$("change-mode").addEventListener("click", () => g.resetConfig());
$("reset-cfg").addEventListener("click", () => { if (confirm("Réinitialiser la configuration ? Vos données locales et documents sont conservés.")) g.resetConfig(); });

$("bk-create").addEventListener("click", async () => { $("bk-msg").textContent = "Création de la sauvegarde…"; const r = await g.backupCreate(); $("bk-msg").textContent = r.message; });
$("bk-restore").addEventListener("click", async () => {
  if (!confirm("Restaurer une sauvegarde écrasera les données locales actuelles. Continuer ?")) return;
  $("bk-msg").textContent = "Restauration…"; const r = await g.backupRestore(); $("bk-msg").textContent = r.message;
});

$("ls-start").addEventListener("click", async () => logOut(await g.localStack.start()));
$("ls-stop").addEventListener("click", async () => logOut(await g.localStack.stop()));
$("ls-status").addEventListener("click", async () => logOut(await g.localStack.status()));
$("ls-reset").addEventListener("click", async () => { if (confirm("Réinitialiser le stack local ? (les conteneurs seront supprimés ; choisissez de garder ou non les données dans le script)")) logOut(await g.localStack.reset()); });

render();
