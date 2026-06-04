/* Assistant de première configuration Gedify (renderer, sans framework). */
"use strict";
const g = window.gedify;
const $ = (id) => document.getElementById(id);
const show = (id) => { ["step-mode","step-remote","step-local","step-full"].forEach((s) => $(s).classList.add("hidden")); $(id).classList.remove("hidden"); };

let mode = null;

/* Étape 1 — sélection du mode */
document.querySelectorAll(".choice").forEach((el) => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".choice").forEach((c) => c.classList.remove("selected"));
    el.classList.add("selected");
    mode = el.getAttribute("data-mode");
    $("mode-next").disabled = false;
  });
});
$("mode-next").addEventListener("click", () => {
  if (mode === "remote_gedify") show("step-remote");
  else if (mode === "local_gedify") { prefillLocalDir(); show("step-local"); }
  else if (mode === "local_full") { show("step-full"); checkDocker(); }
});
document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => show("step-mode")));

function resultHtml(res) {
  const lines = [];
  if (res.gedify) lines.push(`<span class="badge ${res.gedify.ok ? "ok" : "err"}">${res.gedify.ok ? "✓" : "✕"} Gedify</span> <span class="muted">${res.gedify.message}</span>`);
  if (res.paperless) lines.push(`<span class="badge ${res.paperless.ok ? "ok" : "err"}">${res.paperless.ok ? "✓" : "✕"} Paperless</span> <span class="muted">${res.paperless.message}</span>`);
  return lines.map((l) => `<div style="margin:4px 0">${l}</div>`).join("");
}

/* Aide : ouvrir Paperless pour récupérer le token */
function openPaperless(fieldId) {
  const u = ($(fieldId).value || "").trim();
  if (!u) { alert("Renseignez d'abord l'URL Paperless."); return; }
  g.openExternal(/^https?:\/\//i.test(u) ? u : "https://" + u);
}
$("r-open-paperless").addEventListener("click", (e) => { e.preventDefault(); openPaperless("r-paperless"); });
$("l-open-paperless").addEventListener("click", (e) => { e.preventDefault(); openPaperless("l-paperless"); });

/* Étape 2A — serveur distant */
$("r-test").addEventListener("click", async () => {
  const box = $("r-result"); box.classList.remove("hidden"); box.innerHTML = '<span class="muted">Test en cours…</span>';
  const res = await g.testConnection({ gedifyUrl: $("r-gedify").value, paperlessUrl: $("r-paperless").value, paperlessToken: $("r-token").value || undefined });
  box.innerHTML = resultHtml(res);
});
$("r-save").addEventListener("click", async () => {
  if (!$("r-gedify").value.trim()) { alert("Renseignez l'URL du serveur Gedify."); return; }
  await g.saveConfig({
    runtimeMode: "remote_gedify",
    paperlessMode: "remote_paperless",
    gedifyServerUrl: $("r-gedify").value,
    paperlessUrl: $("r-paperless").value || undefined,
    paperlessToken: $("r-token").value || undefined,
  });
  await g.enterApp();
});

/* Étape 2B — local léger */
async function prefillLocalDir() {
  const cfg = await g.getConfig();
  $("l-dir").value = (cfg && cfg.localDataDir) || "~/Library/Application Support/Gedify/data";
}
$("l-choose").addEventListener("click", async () => { const d = await g.chooseDirectory(); if (d) $("l-dir").value = d; });
$("l-test").addEventListener("click", async () => {
  const box = $("l-result"); box.classList.remove("hidden"); box.innerHTML = '<span class="muted">Test en cours…</span>';
  const res = await g.testConnection({ paperlessUrl: $("l-paperless").value, paperlessToken: $("l-token").value || undefined });
  box.innerHTML = resultHtml(res);
});
$("l-save").addEventListener("click", async () => {
  if (!$("l-paperless").value.trim()) { alert("Renseignez l'URL de votre Paperless existant."); return; }
  await g.saveConfig({
    runtimeMode: "local_gedify",
    paperlessMode: "remote_paperless",
    spaceName: $("l-name").value || "Gedify local",
    localDataDir: $("l-dir").value || undefined,
    paperlessUrl: $("l-paperless").value,
    paperlessToken: $("l-token").value || undefined,
  });
  await g.enterApp();
});

/* Étape 2C — local complet */
async function checkDocker() {
  const el = $("f-docker"); el.innerHTML = '<span class="badge warn">Vérification de Docker…</span>';
  const d = await g.docker.check();
  if (d.installed && d.running) {
    el.innerHTML = `<span class="badge ok">✓ ${d.message}</span>`;
    $("f-install").disabled = false;
    $("f-docker-download").classList.add("hidden");
  } else {
    const m = await g.docker.detect();
    el.innerHTML = `<span class="badge err">✕ ${d.message}</span>`
      + `<div class="muted" style="margin-top:6px">macOS détecté : <b>${m.productVersion}</b> (${m.arch === "amd64" ? "Intel" : "Apple Silicon"}) → version conseillée : <b>${m.choice.label}</b>.</div>`;
    $("f-install").disabled = true;
    $("f-docker-download").classList.remove("hidden");
    $("f-docker-download").textContent = "Télécharger & installer la bonne version de Docker";
  }
}
$("f-docker-recheck").addEventListener("click", checkDocker);
$("f-docker-download").addEventListener("click", async () => {
  const log = $("f-log"); log.classList.remove("hidden");
  log.textContent = "Téléchargement de la version Docker compatible avec ton Mac (plusieurs centaines de Mo, patiente)…\n";
  $("f-docker-download").disabled = true;
  const r = await g.docker.autoInstall();
  log.textContent += r.message + "\n"; log.scrollTop = log.scrollHeight;
  $("f-docker-download").disabled = false;
});
$("f-open-paperless").addEventListener("click", (e) => { e.preventDefault(); g.openExternal("http://localhost:8010"); });
$("f-install").addEventListener("click", async () => {
  const log = $("f-log"); log.classList.remove("hidden"); log.textContent = "Installation du stack local…\n";
  $("f-install").disabled = true;
  const inst = await g.localStack.install();
  log.textContent += inst.output + "\n";
  const start = await g.localStack.start();
  log.textContent += start.output + "\n";
  log.scrollTop = log.scrollHeight;
  if (start.ok) {
    log.textContent += "\nStack démarré. Récupération automatique du token Paperless (le 1er démarrage peut prendre 1-2 min)…\n";
    log.scrollTop = log.scrollHeight;
    const tok = await g.localStack.token();
    log.textContent += tok.message + "\n";
    await g.saveConfig({
      runtimeMode: "local_full",
      paperlessMode: "local_paperless",
      gedifyLocalUrl: "http://localhost:3120",
      paperlessUrl: "http://localhost:8010",
      paperlessToken: tok.token, // undefined si Paperless pas encore prêt → réessayable
    });
    log.textContent += tok.ok
      ? "\nPrêt. Cliquez sur « Terminer & ouvrir Gedify local ».\n"
      : "\nPaperless démarre encore. Vous pouvez « Terminer » : Gedify s'ouvrira ; relancez l'install si besoin.\n";
    $("f-finish").classList.remove("hidden");
  } else {
    log.textContent += "\nÉchec — consultez les logs ci-dessus. Vérifiez Docker et les ports (8010, 3120).\n";
    $("f-install").disabled = false;
  }
});
$("f-finish").addEventListener("click", () => g.enterApp());
