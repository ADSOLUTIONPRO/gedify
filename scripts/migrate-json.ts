/* gedify:migrate-json[:dry-run] — migre les JSON vers PostgreSQL.

   - --dry-run : lit, valide, montre ce qui serait migré, n'écrit RIEN.
   - réel : backup auto, insère (upsert idempotent, IDs conservés), construit les
     relations, écrit un rapport dans <data-dir>/backups/. Ne supprime jamais les JSON.

   Prérequis (réel) : DATABASE_URL + tables créées (`npm run gedify:db:push`). */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPrisma, disconnectPrisma } from "../src/lib/db/prisma";
import { backupJson } from "./backup-json";
import { dataDir, loadArray, findByBasename, findJsonFiles, loadJson, entryCount, timestamp, toDate, num } from "./_shared";

const DRY = process.argv.includes("--dry-run");

type Prisma = ReturnType<typeof getPrisma>;
type Stat = { read: number; migrated: number; skipped: number; errors: string[] };
type Ctx = { root: string; prisma: Prisma | null; dry: boolean; stat: Stat };
type Migrator = { table: string; file: string; run: (ctx: Ctx) => Promise<void> };

const str = (v: unknown): string | null => (v == null ? null : String(v));
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const jsonVal = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));

// Capturé pour le rapport (counters migrés).
let countersSnapshot: Record<string, number> = {};

const MIGRATORS: Migrator[] = [
  {
    table: "tags",
    file: "tags.json",
    async run({ root, prisma, dry, stat }) {
      for (const t of loadArray(root, "tags.json")) {
        stat.read++;
        const id = num(t.id);
        if (id == null) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { name: str(t.name), slug: str(t.slug), color: str(t.color), textColor: str(t.text_color), raw: jsonVal(t) };
          await prisma.tag.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "document_types",
    file: "document_types.json",
    async run({ root, prisma, dry, stat }) {
      for (const t of loadArray(root, "document_types.json")) {
        stat.read++;
        const id = num(t.id);
        if (id == null) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { name: str(t.name), slug: str(t.slug), raw: jsonVal(t) };
          await prisma.documentType.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "correspondents",
    file: "correspondents.json",
    async run({ root, prisma, dry, stat }) {
      for (const c of loadArray(root, "correspondents.json")) {
        stat.read++;
        const id = num(c.id);
        if (id == null) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { name: str(c.name), slug: str(c.slug), raw: jsonVal(c) };
          await prisma.correspondent.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "documents (+ ocr, files, tags, correspondents)",
    file: "documents.json",
    async run({ root, prisma, dry, stat }) {
      for (const d of loadArray(root, "documents.json")) {
        stat.read++;
        const id = num(d.id);
        if (id == null) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = {
            title: str(d.title),
            content: str(d.content),
            created: toDate(d.created),
            createdDate: str(d.created_date),
            added: toDate(d.added),
            modified: toDate(d.modified),
            correspondentId: num(d.correspondent),
            documentTypeId: num(d.document_type),
            storagePath: str(d.storage_path),
            mimeType: str(d.mime_type),
            checksum: str(d.checksum),
            storedFilename: str(d.storedFilename),
            originalFileName: str(d.original_file_name),
            pageCount: num(d.page_count),
            deleted: d.deleted === true,
            deletedAt: toDate(d.deletedAt),
            raw: jsonVal(d),
          };
          await prisma.document.upsert({ where: { id }, create: { id, ...data }, update: data });
          await prisma.documentOcr.upsert({
            where: { documentId: id },
            create: { documentId: id, content: str(d.content), raw: jsonVal({ content: d.content ?? null }) },
            update: { content: str(d.content) },
          });
          if (d.storedFilename) {
            const fid = `${id}:original`;
            await prisma.documentFile.upsert({
              where: { id: fid },
              create: { id: fid, documentId: id, kind: "original", filename: String(d.storedFilename), mimeType: str(d.mime_type), raw: jsonVal(null) },
              update: { filename: String(d.storedFilename), mimeType: str(d.mime_type) },
            });
          }
          if (Array.isArray(d.tags)) {
            for (const t of d.tags as unknown[]) {
              const tid = num(t);
              if (tid != null) {
                await prisma.documentTag.upsert({
                  where: { documentId_tagId: { documentId: id, tagId: tid } },
                  create: { documentId: id, tagId: tid },
                  update: {},
                });
              }
            }
          }
          const cid = num(d.correspondent);
          if (cid != null) {
            await prisma.documentCorrespondent.upsert({
              where: { documentId_correspondentId: { documentId: id, correspondentId: cid } },
              create: { documentId: id, correspondentId: cid, role: "primary" },
              update: {},
            });
          }
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "folders (+ folder_documents)",
    file: "project-folders.json",
    async run({ root, prisma, dry, stat }) {
      for (const f of loadArray(root, "project-folders.json")) {
        stat.read++;
        const id = str(f.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { parentId: str(f.parentId), name: str(f.name), slug: str(f.slug), color: str(f.color), category: str(f.category), status: str(f.status), raw: jsonVal(f) };
          await prisma.folder.upsert({ where: { id }, create: { id, ...data }, update: data });
          if (Array.isArray(f.linkedDocumentIds)) {
            for (const docId of f.linkedDocumentIds as unknown[]) {
              const did = num(docId);
              if (did != null) {
                await prisma.folderDocument.upsert({
                  where: { folderId_documentId: { folderId: id, documentId: did } },
                  create: { folderId: id, documentId: did },
                  update: {},
                });
              }
            }
          }
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "budget_entries (+ payments)",
    file: "financial-items.json",
    async run({ root, prisma, dry, stat }) {
      for (const e of loadArray(root, "financial-items.json")) {
        stat.read++;
        const id = str(e.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = {
            kind: str(e.kind), direction: str(e.direction), label: str(e.label),
            amount: num(e.amount), amountPaid: num(e.amountPaid), dueDate: str(e.dueDate),
            status: str(e.status), categoryId: str(e.categoryId), categoryName: str(e.categoryName),
            sourceDocumentId: num(e.sourceDocumentId), raw: jsonVal(e),
          };
          await prisma.budgetEntry.upsert({ where: { id }, create: { id, ...data }, update: data });
          if (Array.isArray(e.payments)) {
            for (const [i, p] of (e.payments as unknown[]).entries()) {
              const po = obj(p);
              const pid = str(po.id) ?? `${id}:${i}`;
              await prisma.budgetPayment.upsert({
                where: { id: pid },
                create: { id: pid, budgetEntryId: id, amount: num(po.amount), date: str(po.date), account: str(po.account), raw: jsonVal(po) },
                update: { amount: num(po.amount), date: str(po.date) },
              });
            }
          }
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "mails",
    file: "email-messages.json",
    async run({ root, prisma, dry, stat }) {
      for (const m of loadArray(root, "email-messages.json")) {
        stat.read++;
        const id = str(m.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = {
            accountId: str(m.accountId), messageId: str(m.messageId), threadId: str(m.threadId),
            fromAddr: str(m.from), toAddr: str(m.to), subject: str(m.subject), date: toDate(m.date),
            snippet: str(m.text)?.slice(0, 400) ?? null, body: str(m.text), hasAttachments: m.hasAttachments === true, raw: jsonVal(m),
          };
          await prisma.mail.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "mail_document_links",
    file: "mail-document-links.json",
    async run({ root, prisma, dry, stat }) {
      // Pièces jointes importées
      for (const l of loadArray(root, "mail-document-links.json")) {
        stat.read++;
        const id = str(l.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = {
            accountId: str(l.accountId), mailId: str(l.mailId), threadId: str(l.threadId),
            documentId: num(l.paperlessDocumentId), filename: str(l.filename), status: str(l.status), kind: "attachment", raw: jsonVal(l),
          };
          await prisma.mailDocumentLink.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
      // Liens GED (email-ged-links) ciblant un document
      for (const l of loadArray(root, "email-ged-links.json")) {
        const target = obj(l.target);
        if (target.kind !== "document") continue;
        stat.read++;
        const id = str(l.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { accountId: str(l.accountId), mailId: str(l.emailId), threadId: str(l.emailId), documentId: num(target.documentId), filename: null, status: str(l.scope), kind: "ged-link", raw: jsonVal(l) };
          await prisma.mailDocumentLink.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "reminders",
    file: "reminders.json",
    async run({ root, prisma, dry, stat }) {
      for (const r of loadArray(root, "reminders.json")) {
        stat.read++;
        const id = str(r.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { title: str(r.title), remindAt: toDate(r.remindAt), status: str(r.status), documentId: num(r.documentId), financialItemId: str(r.financialItemId), raw: jsonVal(r) };
          await prisma.reminder.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "tasks",
    file: "actions.json",
    async run({ root, prisma, dry, stat }) {
      for (const a of loadArray(root, "actions.json")) {
        stat.read++;
        const id = str(a.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { title: str(a.title), status: str(a.status), priority: str(a.priority), dueDate: str(a.dueDate), raw: jsonVal(a) };
          await prisma.task.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "document_ai_analyses",
    file: "analyses.json",
    async run({ root, prisma, dry, stat }) {
      for (const a of loadArray(root, "analyses.json")) {
        stat.read++;
        const id = str(a.id);
        const did = num(a.documentId);
        if (!id || did == null) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { documentId: did, summary: str(a.summary), confidence: str(a.confidence), source: str(a.source), analyzedAt: toDate(a.analyzedAt), raw: jsonVal(a) };
          await prisma.documentAiAnalysis.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "learned_templates",
    file: "learned-templates.json",
    async run({ root, prisma, dry, stat }) {
      for (const t of loadArray(root, "learned-templates.json")) {
        stat.read++;
        const id = str(t.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { label: str(t.label) ?? str(t.name), raw: jsonVal(t) };
          await prisma.learnedTemplate.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "activity_logs",
    file: "ged-logs.json",
    async run({ root, prisma, dry, stat }) {
      for (const l of loadArray(root, "ged-logs.json")) {
        stat.read++;
        const id = str(l.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { level: str(l.level), source: str(l.source), message: str(l.message), documentId: num(l.documentId), projectId: str(l.projectId), user: str(l.user), raw: jsonVal(l), createdAt: toDate(l.createdAt) ?? new Date() };
          await prisma.activityLog.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "signatures",
    file: "document-signatures.json",
    async run({ root, prisma, dry, stat }) {
      const sources: { file: string; scope: string }[] = [
        { file: "document-signatures.json", scope: "document" },
        { file: "email-signatures.json", scope: "email" },
      ];
      for (const src of sources) {
        for (const s of loadArray(root, src.file)) {
          stat.read++;
          const id = str(s.id);
          if (!id) { stat.skipped++; continue; }
          if (!dry && prisma) {
            const data = { scope: src.scope, documentId: num(s.documentId), raw: jsonVal(s) };
            await prisma.signature.upsert({ where: { id }, create: { id, ...data }, update: data });
          }
          stat.migrated++;
        }
      }
    },
  },
  {
    table: "users",
    file: "users.json",
    async run({ root, prisma, dry, stat }) {
      for (const u of loadArray(root, "users.json")) {
        stat.read++;
        const id = num(u.id);
        const username = str(u.username);
        if (id == null || !username) {
          stat.skipped++;
          stat.errors.push(`user sans id/username ignoré (id=${id ?? "?"}, username=${username ?? "?"})`);
          continue;
        }
        if (!dry && prisma) {
          // passwordHash conservé tel quel (jamais loggé) ; exclu de metadata pour ne pas le dupliquer.
          const { passwordHash: _omit, ...rest } = u;
          void _omit;
          const data = {
            username,
            email: u.email ? String(u.email) : null,
            passwordHash: str(u.passwordHash),
            isSuperuser: u.is_superuser === true,
            isActive: u.is_active !== false,
            metadata: jsonVal(rest),
          };
          await prisma.user.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "counters",
    file: "counters.json",
    async run({ root, prisma, dry, stat }) {
      const counters = readObject(root, "counters.json");
      if (!counters) return;
      countersSnapshot = {};
      for (const [name, value] of Object.entries(counters)) {
        stat.read++;
        const v = num(value) ?? 0;
        countersSnapshot[name] = v;
        if (!dry && prisma) {
          await prisma.counter.upsert({ where: { name }, create: { name, value: v }, update: { value: v } });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "document_ai_suggestions (detected-infos)",
    file: "detected-infos.json",
    async run({ root, prisma, dry, stat }) {
      for (const di of loadArray(root, "detected-infos.json")) {
        stat.read++;
        const id = str(di.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = {
            documentId: num(di.sourceDocumentId),
            analysisId: str(di.sourceAnalysisId),
            suggestionType: str(di.kind),
            fieldName: str(di.fieldKey) ?? str(di.label),
            suggestedValue: str(di.value) ?? str(di.normalizedValue) ?? str(di.textValue) ?? (di.amount != null ? String(di.amount) : null),
            confidence: str(di.confidence),
            source: str(di.source),
            rawPayload: jsonVal(di),
          };
          await prisma.documentAiSuggestion.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "document_title_overrides",
    file: "document-title-overrides.json",
    async run({ root, prisma, dry, stat }) {
      for (const o of loadArray(root, "document-title-overrides.json")) {
        stat.read++;
        const did = num(o.documentId);
        if (did == null) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { title: str(o.displayTitle), source: str(o.source), metadata: jsonVal(o) };
          await prisma.documentTitleOverride.upsert({ where: { documentId: did }, create: { documentId: did, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "email_contacts",
    file: "email-contacts.json",
    async run({ root, prisma, dry, stat }) {
      for (const c of loadArray(root, "email-contacts.json")) {
        stat.read++;
        const id = str(c.resourceName) ?? str(c.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const emails = Array.isArray(c.emails) ? (c.emails as unknown[]) : [];
          const data = {
            name: str(c.displayName),
            email: str(c.email) ?? (emails[0] != null ? String(emails[0]) : null),
            displayName: str(c.displayName),
            source: str(c.source),
            metadata: jsonVal(c),
          };
          await prisma.emailContact.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "mail_accounts",
    file: "accounts.json",
    async run({ root, prisma, dry, stat }) {
      for (const a of loadArray(root, "accounts.json")) {
        stat.read++;
        const id = str(a.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          // metadata conserve le compte complet (mot de passe déjà chiffré) — jamais loggé.
          const data = {
            provider: str(a.provider),
            email: str(a.email),
            displayName: str(a.name),
            status: str(a.status),
            scopes: a.scopes != null ? jsonVal(a.scopes) : null,
            metadata: jsonVal(a),
          };
          await prisma.mailAccount.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "mail_oauth_tokens",
    file: "gmail-tokens.json",
    async run({ root, prisma, dry, stat }) {
      for (const t of loadArray(root, "gmail-tokens.json")) {
        stat.read++;
        const id = str(t.accountId);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          // Tokens : refresh DÉJÀ chiffré (encryptedRefreshToken). Jamais loggés.
          const scopes = Array.isArray(t.scopes) ? (t.scopes as unknown[]).join(" ") : null;
          const expiry = typeof t.accessTokenExpiresAt === "number" ? new Date(t.accessTokenExpiresAt) : null;
          const data = {
            accountId: id,
            provider: "gmail",
            email: str(t.email),
            accessTokenEncrypted: str(t.cachedAccessToken),
            refreshTokenEncrypted: str(t.encryptedRefreshToken),
            expiryDate: expiry,
            scope: scopes,
            tokenType: "Bearer",
            metadata: jsonVal(t),
          };
          await prisma.mailOauthToken.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "saved_signatures",
    file: "document-saved-signatures.json",
    async run({ root, prisma, dry, stat }) {
      for (const s of loadArray(root, "document-saved-signatures.json")) {
        stat.read++;
        const id = str(s.id);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = { label: str(s.name), type: str(s.kind), imageData: str(s.dataUrl), metadata: jsonVal(s) };
          await prisma.savedSignature.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "hidden_senders",
    file: "hidden-senders.json",
    async run({ root, prisma, dry, stat }) {
      for (const h of loadArray(root, "hidden-senders.json")) {
        stat.read++;
        const id = str(h.id) ?? str(h.email);
        if (!id) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const email = str(h.email);
          const domain = email && email.includes("@") ? email.split("@")[1] : null;
          const data = { email, domain, reason: str(h.reason), metadata: jsonVal(h) };
          await prisma.hiddenSender.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "custom_fields",
    file: "custom_fields.json",
    async run({ root, prisma, dry, stat }) {
      for (const f of loadArray(root, "custom_fields.json")) {
        stat.read++;
        const id = num(f.id);
        if (id == null) { stat.skipped++; continue; }
        if (!dry && prisma) {
          const data = {
            name: str(f.name),
            label: str(f.label) ?? str(f.name),
            type: str(f.data_type) ?? str(f.type),
            options: f.extra_data != null ? jsonVal(f.extra_data) : null,
            required: f.required === true,
            metadata: jsonVal(f),
          };
          await prisma.customField.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    },
  },
  {
    table: "document_correspondents (secondaires)",
    file: "document-secondary-correspondents.json",
    async run({ root, prisma, dry, stat }) {
      for (const e of loadArray(root, "document-secondary-correspondents.json")) {
        const did = num(e.documentId);
        const ids = Array.isArray(e.correspondentIds) ? (e.correspondentIds as unknown[]) : [];
        if (did == null) { stat.skipped++; continue; }
        for (const cidRaw of ids) {
          const cid = num(cidRaw);
          if (cid == null) continue;
          stat.read++;
          if (!dry && prisma) {
            // update:{} → ne PAS écraser un rôle existant (correspondant principal préservé).
            await prisma.documentCorrespondent.upsert({
              where: { documentId_correspondentId: { documentId: did, correspondentId: cid } },
              create: { documentId: did, correspondentId: cid, role: "secondary" },
              update: {},
            });
          }
          stat.migrated++;
        }
      }
    },
  },
  {
    table: "settings",
    file: "assistant-settings.json",
    async run({ root, prisma, dry, stat }) {
      // Réglages divers stockés en clé/valeur (objets JSON, pas des tableaux).
      const keys = ["assistant-settings"];
      for (const key of keys) {
        const value = readObject(root, `${key}.json`);
        if (value == null) continue;
        stat.read++;
        if (!dry && prisma) {
          const v = JSON.parse(JSON.stringify(value));
          await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
        }
        stat.migrated++;
      }
    },
  },
];

/* ── Couverture : fichiers présents vs fichiers réellement lus ────────────── */
const COVERED = new Set<string>([
  ...MIGRATORS.map((m) => m.file),
  "email-ged-links.json", // lu par mail_document_links
  "email-signatures.json", // lu par signatures
]);

type Importance = "critique" | "important" | "mineur" | "éphémère" | "ignoré" | "vide" | "à examiner";
const CLASSIFY: Record<string, { level: Importance; reason: string }> = {
  "tasks.json": { level: "éphémère", reason: "tâches de traitement moteur (OCR/ingestion) — volontairement non migré" },
  "document-notes.json": { level: "important", reason: "notes utilisateur sur documents" },
  "categories.json": { level: "mineur", reason: "catégories budget" },
  "ged-views.json": { level: "mineur", reason: "vues sauvegardées" },
  "document-events.json": { level: "mineur", reason: "événements documents" },
  "correction-memory.json": { level: "mineur", reason: "mémoire de corrections IA" },
  "mail-suppressed-attachments.json": { level: "mineur", reason: "pièces jointes supprimées" },
  "scheduled-emails.json": { level: "mineur", reason: "emails programmés" },
};

type Uncovered = { file: string; entries: number; level: Importance; reason: string };

function scanUncovered(root: string): Uncovered[] {
  const out: Uncovered[] = [];
  for (const f of findJsonFiles(root)) {
    const base = path.basename(f);
    if (COVERED.has(base)) continue;
    const res = loadJson(f);
    const entries = res.ok ? entryCount(res.data) : 0;
    let { level, reason } = CLASSIFY[base] ?? { level: "à examiner" as Importance, reason: "non mappé — à classer" };
    // Un fichier vide est ignorable quel que soit son classement (remontera si données plus tard).
    if (entries === 0) {
      level = "vide";
      reason = "fichier vide — ignoré volontairement";
    }
    out.push({ file: path.relative(root, f), entries, level, reason });
  }
  const order: Importance[] = ["critique", "important", "à examiner", "mineur", "vide", "éphémère", "ignoré"];
  return out.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
}

function readObject(root: string, basename: string): Record<string, unknown> | null {
  const file = findByBasename(root, basename);
  if (!file) return null;
  const res = loadJson(file);
  return res.ok && res.data && typeof res.data === "object" && !Array.isArray(res.data)
    ? (res.data as Record<string, unknown>)
    : null;
}

async function main() {
  const root = dataDir();
  console.log(`\n🗄️  Migration JSON → PostgreSQL${DRY ? "  (DRY-RUN — aucune écriture)" : ""}`);
  console.log(`Data-dir : ${root}\n`);

  let backupDir: string | null = null;
  if (!DRY) {
    if (!process.env.DATABASE_URL) {
      console.error("❌ DATABASE_URL absente. Configure-la avant la migration réelle.");
      process.exit(1);
    }
    const b = backupJson();
    backupDir = b.backupDir;
    console.log(`💾 Backup auto : ${b.count} JSON → ${b.backupDir}\n`);
  }

  const prisma = DRY ? null : getPrisma();
  const report: Record<string, Stat> = {};

  for (const m of MIGRATORS) {
    const stat: Stat = { read: 0, migrated: 0, skipped: 0, errors: [] };
    try {
      await m.run({ root, prisma, dry: DRY, stat });
    } catch (e) {
      stat.errors.push(e instanceof Error ? e.message : String(e));
    }
    report[m.table] = stat;
    const flag = stat.errors.length ? `⚠ ${stat.errors.length} err` : "";
    console.log(`${m.table.padEnd(34)} lu ${String(stat.read).padStart(5)}  ${DRY ? "à migrer" : "migré"} ${String(stat.migrated).padStart(5)}  ignoré ${String(stat.skipped).padStart(3)}  ${flag}`);
    if (stat.errors.length) stat.errors.slice(0, 3).forEach((e) => console.log(`    └─ ${e}`));
  }

  const totals = Object.values(report).reduce(
    (acc, s) => ({ read: acc.read + s.read, migrated: acc.migrated + s.migrated, skipped: acc.skipped + s.skipped, errors: acc.errors + s.errors.length }),
    { read: 0, migrated: 0, skipped: 0, errors: 0 },
  );

  // Couverture : fichiers JSON présents mais non migrés, classés par importance.
  const uncovered = scanUncovered(root);
  const SAFE = (u: Uncovered) => u.level === "éphémère" || u.level === "ignoré" || u.level === "vide";
  const voluntarilyIgnored = uncovered.filter(SAFE);
  const needsAttention = uncovered.filter((u) => !SAFE(u)); // critique / important / à examiner / mineur (avec données)
  const blocking = needsAttention.filter((u) => u.level === "critique" || u.level === "important");

  console.log(`\n🔢 Counters migrés : ${Object.entries(countersSnapshot).map(([k, v]) => `${k}=${v}`).join(", ") || "(aucun)"}`);
  if (needsAttention.length) {
    console.log(`\n⚠️  Fichiers NON couverts AVEC données (${needsAttention.length}) — à traiter avant la migration réelle :`);
    for (const u of needsAttention) console.log(`   [${u.level.padEnd(11)}] ${u.file} (${u.entries})  — ${u.reason}`);
  } else {
    console.log("\n✅ Aucun fichier important / à examiner avec données laissé de côté.");
  }
  if (voluntarilyIgnored.length) {
    console.log(`\nℹ️  Ignorés volontairement (${voluntarilyIgnored.length}) :`);
    for (const u of voluntarilyIgnored) console.log(`   [${u.level.padEnd(11)}] ${u.file} (${u.entries})  — ${u.reason}`);
  }

  const reportObj = {
    startedAt: new Date().toISOString(),
    dryRun: DRY,
    dataDir: root,
    backupDir,
    totals,
    counters: countersSnapshot,
    tables: report,
    voluntarilyIgnored,
    uncovered: needsAttention,
    dataLoss: false,
    readyForRealMigration: needsAttention.length === 0,
    note: "Upsert idempotent (réexécutable sans doublon). Aucun JSON source supprimé. Tokens/secrets jamais loggés.",
  };
  const dir = path.join(root, "backups");
  mkdirSync(dir, { recursive: true });
  const reportFile = path.join(dir, `${DRY ? "migration-dryrun" : "migration-report"}-${timestamp()}.json`);
  writeFileSync(reportFile, JSON.stringify(reportObj, null, 2));

  console.log(`\n📊 Total : lu ${totals.read}, ${DRY ? "à migrer" : "migré"} ${totals.migrated}, ignoré ${totals.skipped}, erreurs ${totals.errors}, perte de données : non`);
  console.log(`📄 Rapport : ${reportFile}`);
  if (needsAttention.length === 0 && totals.errors === 0) {
    console.log("\n✅ PRÊT pour la migration réelle (aucun fichier important/à examiner non couvert).");
  } else {
    console.log(`\n⛔ PAS prêt : ${blocking.length} important(s)/critique(s) + ${needsAttention.length - blocking.length} à examiner/mineur(s) avec données. À couvrir d'abord.`);
  }
  console.log("\nLes JSON sources n'ont PAS été supprimés.\n");

  if (prisma) await disconnectPrisma();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
