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

/** Au moins un utilisateur enregistré ? Sinon → écran de 1ʳᵉ connexion (/installation). */
export async function hasAnyUser(): Promise<boolean> {
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
