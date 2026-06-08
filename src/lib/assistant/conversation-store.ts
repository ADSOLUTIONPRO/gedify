import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Conversations persistantes de l'assistant IA.
   Source de vérité = stockage serveur (JSON / SQLite / Postgres via pg-store),
   exactement comme project-store. Portée par utilisateur (userId) — un
   utilisateur ne voit que ses conversations. Messages embarqués dans la
   conversation (un blob par conversation → lecture/écriture par fil, pas de
   scan global des messages).
   ──────────────────────────────────────────────────────────────────────── */

export type AiConversationRole = "user" | "assistant" | "system";

export type AiConversationMessage = {
  id: string;
  role: AiConversationRole;
  content: string;
  createdAt: string;
  /** Métadonnées libres (actions proposées, provider…). */
  metadata?: Record<string, unknown> | null;
  /** Références documentaires citées dans le message. */
  documentRefs?: unknown[] | null;
  error?: boolean;
};

export type AiConversationContext = {
  documentIds: number[];
  folderId: string | null;
};

export type AiConversation = {
  id: string;
  userId: string;
  title: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  context: AiConversationContext | null;
  model: string | null;
  provider: string | null;
  messages: AiConversationMessage[];
};

/** Vue allégée (sans messages) pour la liste d'historique. */
export type AiConversationSummary = Omit<AiConversation, "messages"> & {
  messageCount: number;
  lastMessagePreview: string | null;
};

const COLLECTION = "ai_conversations";
const JSON_FILE = "ai-conversations.json";
const DEFAULT_TITLE = "Nouveau chat";
const MAX_MESSAGES_PER_CONVERSATION = 400;

function jsonPath() {
  return path.join(getDataDir(), JSON_FILE);
}

async function readAll(): Promise<AiConversation[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<AiConversation>(COLLECTION);
    } catch (e) {
      if (jsonFallback()) return readJson();
      throw e;
    }
  }
  return readJson();
}

async function readJson(): Promise<AiConversation[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AiConversation[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(items: AiConversation[]): Promise<void> {
  if (pgStorageActive()) {
    await pgWriteAll<AiConversation>(COLLECTION, "id", (c) => c.id, items);
    return;
  }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function toSummary(c: AiConversation): AiConversationSummary {
  const last = c.messages[c.messages.length - 1] ?? null;
  const { messages: _messages, ...rest } = c;
  return {
    ...rest,
    messageCount: c.messages.length,
    lastMessagePreview: last ? last.content.slice(0, 120) : null,
  };
}

function sortRecent(a: AiConversation, b: AiConversation): number {
  const ta = a.lastMessageAt ?? a.updatedAt;
  const tb = b.lastMessageAt ?? b.updatedAt;
  return ta < tb ? 1 : ta > tb ? -1 : 0;
}

/** Liste des conversations d'un utilisateur (résumés, sans messages). */
export async function listConversations(
  userId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<AiConversationSummary[]> {
  const all = await readAll();
  return all
    .filter((c) => c.userId === userId && (opts.includeArchived ? true : c.status !== "archived"))
    .sort(sortRecent)
    .map(toSummary);
}

/** Récupère une conversation SI elle appartient à l'utilisateur (sinon null). */
export async function getConversation(id: string, userId: string): Promise<AiConversation | null> {
  const all = await readAll();
  const c = all.find((x) => x.id === id);
  if (!c || c.userId !== userId) return null;
  return c;
}

export async function createConversation(
  userId: string,
  input: { title?: string; context?: AiConversationContext | null; model?: string | null; provider?: string | null } = {},
): Promise<AiConversation> {
  const now = new Date().toISOString();
  const conversation: AiConversation = {
    id: randomUUID(),
    userId,
    title: input.title?.trim() || DEFAULT_TITLE,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastMessageAt: null,
    context: input.context ?? null,
    model: input.model ?? null,
    provider: input.provider ?? null,
    messages: [],
  };
  const all = await readAll();
  all.unshift(conversation);
  await writeAll(all);
  return conversation;
}

export async function updateConversation(
  id: string,
  userId: string,
  patch: { title?: string; status?: "active" | "archived"; context?: AiConversationContext | null; model?: string | null; provider?: string | null },
): Promise<AiConversation | null> {
  const all = await readAll();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1 || all[idx].userId !== userId) return null;
  const next: AiConversation = {
    ...all[idx],
    ...(patch.title !== undefined ? { title: patch.title.trim() || DEFAULT_TITLE } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.context !== undefined ? { context: patch.context } : {}),
    ...(patch.model !== undefined ? { model: patch.model } : {}),
    ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  await writeAll(all);
  return next;
}

export async function deleteConversation(id: string, userId: string): Promise<boolean> {
  const all = await readAll();
  const target = all.find((c) => c.id === id);
  if (!target || target.userId !== userId) return false;
  await writeAll(all.filter((c) => c.id !== id));
  return true;
}

/** Titre court dérivé du premier message utilisateur (sans appel IA). */
function deriveTitle(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) return DEFAULT_TITLE;
  return clean.length > 48 ? `${clean.slice(0, 48).trimEnd()}…` : clean;
}

/**
 * Ajoute un ou plusieurs messages (ids stables idempotents). Met à jour
 * lastMessageAt et, si le titre est encore « Nouveau chat », le dérive du
 * premier message utilisateur.
 */
export async function appendMessages(
  id: string,
  userId: string,
  messages: Array<Omit<AiConversationMessage, "createdAt"> & { createdAt?: string }>,
): Promise<AiConversation | null> {
  const all = await readAll();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1 || all[idx].userId !== userId) return null;
  const conv = all[idx];
  const now = new Date().toISOString();

  const existingIds = new Set(conv.messages.map((m) => m.id));
  const incoming = messages
    .filter((m) => !existingIds.has(m.id)) // anti-doublon (multi-onglets / retries)
    .map<AiConversationMessage>((m) => ({ ...m, createdAt: m.createdAt ?? now }));
  if (incoming.length === 0) return conv;

  let title = conv.title;
  if (title === DEFAULT_TITLE) {
    const firstUser = [...conv.messages, ...incoming].find((m) => m.role === "user");
    if (firstUser) title = deriveTitle(firstUser.content);
  }

  const merged = [...conv.messages, ...incoming].slice(-MAX_MESSAGES_PER_CONVERSATION);
  const next: AiConversation = {
    ...conv,
    title,
    messages: merged,
    lastMessageAt: now,
    updatedAt: now,
  };
  all[idx] = next;
  await writeAll(all);
  return next;
}
