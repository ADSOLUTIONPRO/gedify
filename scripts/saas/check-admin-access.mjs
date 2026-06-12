/* saas:check-admin-access — vérifications statiques de la séparation
   superadmin / client (analyse du code source). Exit 1 si une garde manque.
   À lancer depuis le dépôt (diagnostic de build, pas dans le conteneur runtime). */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => { try { return readFileSync(path.join(ROOT, p), "utf8"); } catch { return ""; } };
let problems = 0;
const ok = (m) => console.log(`   ✅ ${m}`);
const ko = (m) => { console.log(`   ❌ ${m}`); problems++; };

console.log("Séparation superadmin / client :");

// 1. Garde serveur sur /admin/saas/*
const layout = read("src/app/admin/saas/layout.tsx");
if (/is_superuser/.test(layout) && /Accès refusé|403/.test(layout)) ok("/admin/saas/layout.tsx bloque les non-superusers (403).");
else ko("/admin/saas/layout.tsx ne bloque pas clairement les non-superusers.");

// 2. Helper requireSuperuser
const guards = read("src/lib/auth/guards.ts");
if (/export async function requireSuperuser/.test(guards)) ok("requireSuperuser() présent.");
else ko("requireSuperuser() absent (src/lib/auth/guards.ts).");

// 3. Pages /settings/* présentes
const settingsPages = ["page", "myplan/page", "billing/page", "notifications/page", "team/page", "data/page", "security/page", "support/page", "utilisateurs/page", "invite/page"];
const missing = settingsPages.filter((p) => !existsSync(path.join(ROOT, "src/app/settings", `${p}.tsx`)));
if (missing.length === 0) ok(`Pages /settings/* présentes (${settingsPages.length}).`);
else ko(`Pages /settings manquantes : ${missing.join(", ")}`);

// 4. /administration redirige les clients vers /settings
const admin = read("src/app/administration/page.tsx");
if (/redirect\("\/settings"\)/.test(admin)) ok("/administration redirige les clients vers /settings.");
else ko("/administration ne redirige pas les clients vers /settings.");

// 5. Menu client : aucun lien /admin/saas dans le bloc CLIENT_SETTINGS
const dropdown = read("src/components/navigation/administration-dropdown.tsx");
const clientBlock = (dropdown.match(/CLIENT_SETTINGS[\s\S]*?\];/) || [""])[0];
if (clientBlock && !/\/admin\/saas/.test(clientBlock)) ok("Menu client (« Paramètres ») sans lien /admin/saas.");
else ko("Le menu client contient un lien /admin/saas (fuite).");

// 6. « Gestion clients » gardé par saasAdmin
if (/saasAdmin/.test(dropdown) && /\/admin\/saas/.test(dropdown)) ok("« Gestion clients » conditionné à saasAdmin.");
else ko("« Gestion clients » non conditionné à saasAdmin.");

// 7. Menu d'espace : entrée superuserOnly gardée
const sidebar = read("src/components/layout/space-menu-sidebar.tsx");
if (/superuserOnly/.test(sidebar) && /saasAdmin/.test(sidebar)) ok("Sidebar filtre les entrées superuserOnly.");
else ko("Sidebar ne filtre pas les entrées superuserOnly.");

if (problems === 0) console.log("\n✅ Séparation superadmin/client conforme.");
else console.log(`\n❌ ${problems} problème(s) détecté(s).`);
process.exit(problems > 0 ? 1 : 0);
