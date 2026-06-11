import "server-only";

import bcrypt from "bcryptjs";
import { mutateList, nextId, readStore, STORE, type EngineUser } from "./stores";
import { roleOf, type Role } from "@/lib/auth/permissions";
import { isStaging } from "@/lib/config/environment";
import type { PaperlessProfile } from "@/lib/paperless-types";

/** Identifiants de l'admin par défaut amorcé UNIQUEMENT en staging (cf. ensureBootstrapAdmin). */
const STAGING_DEFAULT_ADMIN_USER = "admin";
const STAGING_DEFAULT_ADMIN_PASSWORD = "admin";

/* ────────────────────────────────────────────────────────────────────────
   Utilisateurs locaux (remplacent les users Paperless). Mots de passe hashés
   bcrypt. Un admin est créé au 1er lancement depuis l'environnement.
   ──────────────────────────────────────────────────────────────────────── */

export type CreateUserInput = {
  username: string;
  password?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_superuser?: boolean;
  is_staff?: boolean;
  role?: Role;
};

/**
 * Amorçage de l'administrateur depuis l'environnement — RÉTABLI après régression.
 *
 * Le passage au « flow d'installation » (commit 35f963e) avait supprimé cette
 * amorce, ce qui a cassé les déploiements (ex. Synology) qui s'appuyaient sur un
 * admin fourni par variables d'environnement : plus rien ne créait le compte, et
 * la connexion renvoyait « identifiant ou mot de passe incorrect ».
 *
 * Opt-in et SANS identifiant par défaut (plus de `admin`/`admin`) : si les
 * variables ne sont pas définies, le flux /installation prend le relais.
 *
 *   GEDIFY_ADMIN_USER      identifiant de l'admin amorcé
 *   GEDIFY_ADMIN_PASSWORD  mot de passe de l'admin amorcé
 *   GEDIFY_ADMIN_MAIL      (optionnel) e-mail
 *   GEDIFY_ADMIN_RESET     « true/1 » → si le compte existe déjà mais que le mot
 *                          de passe ne correspond plus (volume recréé, bascule de
 *                          backend…), le réinitialise sur GEDIFY_ADMIN_PASSWORD.
 */
let bootstrapAttempted = false;

export async function ensureBootstrapAdmin(): Promise<void> {
  if (bootstrapAttempted) return;
  bootstrapAttempted = true;

  let username = process.env.GEDIFY_ADMIN_USER?.trim();
  let password = process.env.GEDIFY_ADMIN_PASSWORD;

  // ── Admin par défaut « clé en main » UNIQUEMENT en staging ─────────────────
  // Sur la version SaaS staging (APP_ENV / NEXT_PUBLIC_APP_ENV = staging), si
  // aucun identifiant d'amorçage n'est fourni, on amorce un admin par défaut
  // (admin / admin) pour pouvoir se connecter immédiatement aux données de test.
  // STRICTEMENT gardé par isStaging() → aucun effet en développement, en
  // production (saas-production), sur main ni sur Docker Synology (qui ne posent
  // jamais APP_ENV=staging). Surchargeable via GEDIFY_ADMIN_USER /
  // GEDIFY_ADMIN_PASSWORD ; réinitialisable via GEDIFY_ADMIN_RESET=true.
  if ((!username || !password) && isStaging()) {
    username = username || STAGING_DEFAULT_ADMIN_USER;
    password = password || STAGING_DEFAULT_ADMIN_PASSWORD;
    console.warn(
      "[engine] STAGING : identifiants admin par défaut actifs (admin/admin). " +
        "Changez le mot de passe depuis l'interface ou définissez GEDIFY_ADMIN_USER/GEDIFY_ADMIN_PASSWORD.",
    );
  }

  if (!username || !password) return; // pas d'admin env → flux /installation

  const users = await readStore<EngineUser[]>(STORE.users, []);

  // Store vide → amorçage initial (comportement historique restauré).
  if (users.length === 0) {
    await createUser({
      username,
      password,
      email: process.env.GEDIFY_ADMIN_MAIL?.trim() ?? "",
      is_superuser: true,
      is_staff: true,
    });
    console.log(`[engine] administrateur initial (env) créé : « ${username} ».`);
    return;
  }

  // Récupération optionnelle : forcer le mot de passe de l'admin env si demandé.
  const reset = /^(1|true|yes)$/i.test((process.env.GEDIFY_ADMIN_RESET ?? "").trim());
  if (!reset) return;

  const existing = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    const matches = existing.passwordHash
      ? await bcrypt.compare(password, existing.passwordHash)
      : false;
    if (!matches || !existing.is_active) {
      await updateUser(existing.id, { password, is_active: true, is_superuser: true, is_staff: true });
      console.log(`[engine] mot de passe de « ${username} » réinitialisé via GEDIFY_ADMIN_RESET.`);
    }
  } else {
    await createUser({
      username,
      password,
      email: process.env.GEDIFY_ADMIN_MAIL?.trim() ?? "",
      is_superuser: true,
      is_staff: true,
    });
    console.log(`[engine] administrateur « ${username} » (re)créé via GEDIFY_ADMIN_RESET.`);
  }
}

/** Au moins un utilisateur enregistré ? Sinon → écran de 1ʳᵉ connexion (/installation). */
export async function hasAnyUser(): Promise<boolean> {
  await ensureBootstrapAdmin();
  const users = await readStore<EngineUser[]>(STORE.users, []);
  return users.length > 0;
}

/**
 * Crée le tout premier administrateur via le formulaire de première connexion.
 * Refuse si un utilisateur existe déjà — empêche tout détournement de l'écran
 * d'installation une fois l'application initialisée. Le compte est persisté
 * dans le store (volume /app/.data) : aucun identifiant en variable d'env.
 */
export async function createFirstAdmin(input: {
  username: string;
  password: string;
  email?: string;
}): Promise<EngineUser> {
  if (await hasAnyUser()) throw new Error("already_initialized");
  const user = await createUser({
    username: input.username,
    password: input.password,
    email: input.email ?? "",
    is_superuser: true,
    is_staff: true,
  });
  console.log(`[engine] administrateur initial créé : « ${user.username} ».`);
  return user;
}

export async function listUsers(): Promise<EngineUser[]> {
  await ensureBootstrapAdmin();
  return readStore<EngineUser[]>(STORE.users, []);
}

export async function createUser(input: CreateUserInput): Promise<EngineUser> {
  const id = await nextId("users");
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : "";
  const user: EngineUser = {
    id,
    username: input.username,
    passwordHash,
    email: input.email ?? "",
    first_name: input.first_name ?? "",
    last_name: input.last_name ?? "",
    is_superuser: input.is_superuser ?? false,
    is_staff: input.is_staff ?? input.is_superuser ?? false,
    is_active: true,
    ...(input.role ? { role: input.role } : {}),
  };
  await mutateList<EngineUser>(STORE.users, (list) => [...list, user]);
  return user;
}

export async function updateUser(id: number, patch: Partial<CreateUserInput> & { is_active?: boolean }): Promise<EngineUser | null> {
  let updated: EngineUser | null = null;
  await mutateList<EngineUser>(STORE.users, async (list) =>
    Promise.all(
      list.map(async (u) => {
        if (u.id !== id) return u;
        updated = {
          ...u,
          username: patch.username ?? u.username,
          email: patch.email ?? u.email,
          first_name: patch.first_name ?? u.first_name,
          last_name: patch.last_name ?? u.last_name,
          is_superuser: patch.is_superuser ?? u.is_superuser,
          is_staff: patch.is_staff ?? u.is_staff,
          is_active: patch.is_active ?? u.is_active,
          role: patch.role ?? u.role,
          passwordHash: patch.password ? await bcrypt.hash(patch.password, 10) : u.passwordHash,
        };
        return updated;
      }),
    ),
  );
  return updated;
}

export async function deleteUser(id: number): Promise<void> {
  await mutateList<EngineUser>(STORE.users, (list) => list.filter((u) => u.id !== id));
}

/** Vérifie un couple identifiant / mot de passe contre le store local. */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  await ensureBootstrapAdmin();
  const users = await readStore<EngineUser[]>(STORE.users, []);
  // Recherche tolérante : par identifiant OU par e-mail (trim + lowercase) afin
  // d'accepter les comptes existants quel que soit le champ saisi à la connexion.
  const key = username.trim().toLowerCase();
  const u = users.find(
    (x) => x.username.trim().toLowerCase() === key || (x.email ?? "").trim().toLowerCase() === key,
  );
  const debug = process.env.GEDIFY_AUTH_DEBUG === "1" || process.env.GEDIFY_AUTH_DEBUG === "true";
  if (!u || !u.is_active || !u.passwordHash) {
    if (debug) {
      console.log(
        `[auth] userFound=${Boolean(u)} accountActive=${Boolean(u?.is_active)} hasPasswordHash=${Boolean(u?.passwordHash)} passwordVerified=false`,
      );
    }
    return false;
  }
  const verified = await bcrypt.compare(password, u.passwordHash);
  if (debug) {
    const fmt = /^\$2[aby]\$/.test(u.passwordHash)
      ? "bcrypt"
      : /^\$argon/i.test(u.passwordHash)
        ? "argon2"
        : "unknown";
    console.log(`[auth] userFound=true accountActive=true passwordHashFormat=${fmt} passwordVerified=${verified}`);
  }
  return verified;
}

/** Profil exposé par /api/profile/ (premier superuser). */
export async function primaryProfile(): Promise<PaperlessProfile> {
  const users = await readStore<EngineUser[]>(STORE.users, []);
  const u = users.find((x) => x.is_superuser) ?? users[0];
  return {
    email: u?.email ?? "",
    first_name: u?.first_name ?? "",
    last_name: u?.last_name ?? "",
    has_usable_password: true,
    is_mfa_enabled: false,
  };
}

/** Forme publique (sans hash) pour /api/users/. */
export function publicUser(u: EngineUser) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    is_superuser: u.is_superuser,
    is_staff: u.is_staff,
    is_active: u.is_active,
    /** Rôle effectif (explicite ou déduit). */
    role: roleOf(u),
  };
}
