import "server-only";

import bcrypt from "bcryptjs";
import { mutateList, nextId, readStore, STORE, type EngineUser } from "./stores";
import type { PaperlessProfile } from "@/lib/paperless-types";

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
};

let bootstrapped = false;

/** Crée l'admin initial (GEDIFY_ADMIN_USER / GEDIFY_ADMIN_PASSWORD) si aucun user. */
export async function ensureBootstrapAdmin(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  const users = await readStore<EngineUser[]>(STORE.users, []);
  if (users.length > 0) return;
  const username = process.env.GEDIFY_ADMIN_USER?.trim() || "admin";
  const password = process.env.GEDIFY_ADMIN_PASSWORD || "admin";
  await createUser({
    username,
    password,
    email: process.env.GEDIFY_ADMIN_MAIL?.trim() ?? "",
    is_superuser: true,
    is_staff: true,
  });
  console.log(`[engine] admin local initial créé : « ${username} » (modifiable dans Utilisateurs).`);
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
  const u = users.find((x) => x.username.toLowerCase() === username.toLowerCase());
  if (!u || !u.is_active || !u.passwordHash) return false;
  return bcrypt.compare(password, u.passwordHash);
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
  };
}
