import type { EngineUser } from "@/lib/engine/stores";

/* ────────────────────────────────────────────────────────────────────────
   Rôles & permissions (Chantier permissions).

   Structure prévue pour le multi-utilisateur, sans rien casser pour l'unique
   compte actuel : un superuser (ou un utilisateur non résolu) = admin = tous
   droits. On ne RESTREINT que lorsqu'un rôle non-admin est positivement établi.
   ──────────────────────────────────────────────────────────────────────── */

export type Role = "admin" | "manager" | "editor" | "viewer";

export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "admin", label: "Administrateur", description: "Tous les droits, y compris administration et utilisateurs." },
  { value: "manager", label: "Gestionnaire", description: "Gère documents, finances, mails, automatisations et sauvegardes." },
  { value: "editor", label: "Éditeur", description: "Crée et modifie des documents, utilise l'IA, consulte les finances." },
  { value: "viewer", label: "Lecteur", description: "Consultation seule des documents et finances." },
];

export type Permission =
  | "documents.view"
  | "documents.edit"
  | "documents.delete"
  | "ai.use"
  | "finances.view"
  | "finances.edit"
  | "mails.manage"
  | "automation.manage"
  | "backup.manage"
  | "admin.access"
  | "users.manage";

export const PERMISSION_LABELS: Record<Permission, string> = {
  "documents.view": "Consulter les documents",
  "documents.edit": "Modifier les documents",
  "documents.delete": "Supprimer des documents",
  "ai.use": "Utiliser l'IA",
  "finances.view": "Consulter les finances",
  "finances.edit": "Modifier les finances",
  "mails.manage": "Gérer la messagerie",
  "automation.manage": "Gérer les règles / workflows",
  "backup.manage": "Sauvegarder / restaurer",
  "admin.access": "Accéder à l'administration",
  "users.manage": "Gérer les utilisateurs et rôles",
};

const ALL: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,
  manager: [
    "documents.view",
    "documents.edit",
    "documents.delete",
    "ai.use",
    "finances.view",
    "finances.edit",
    "mails.manage",
    "automation.manage",
    "backup.manage",
  ],
  editor: ["documents.view", "documents.edit", "ai.use", "finances.view", "mails.manage"],
  viewer: ["documents.view", "finances.view"],
};

/** Rôle effectif d'un utilisateur (rôle explicite, sinon déduit). */
export function roleOf(user: Pick<EngineUser, "role" | "is_superuser" | "is_staff"> | null | undefined): Role {
  if (!user) return "admin"; // utilisateur non résolu → on n'enferme jamais
  if (user.role) return user.role;
  if (user.is_superuser) return "admin";
  if (user.is_staff) return "manager";
  return "editor";
}

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** L'utilisateur a-t-il la permission ? (admin = toujours oui ; non résolu = oui) */
export function can(
  user: Pick<EngineUser, "role" | "is_superuser" | "is_staff"> | null | undefined,
  permission: Permission,
): boolean {
  const role = roleOf(user);
  if (role === "admin") return true;
  return permissionsForRole(role).includes(permission);
}
