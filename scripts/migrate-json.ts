/* gedify:migrate-json[:dry-run] — migre les JSON vers PostgreSQL.

   - --dry-run : lit, valide, montre ce qui serait migré, n'écrit RIEN.
   - réel : backup auto, insère (upsert idempotent, IDs conservés), construit les
     relations, écrit un rapport dans <data-dir>/backups/. Ne supprime jamais les JSON.

   Prérequis (réel) : DATABASE_URL + tables créées (`npm run gedify:db:push`). */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPrisma, disconnectPrisma } from "../src/lib/db/prisma";
import { backupJson } from "./backup-json";
import { dataDir, loadArray, findByBasename, loadJson, timestamp, toDate, num } from "./_shared";

const DRY = process.argv.includes("--dry-run");

type Prisma = ReturnType<typeof getPrisma>;
type Stat = { read: number; migrated: number; skipped: number; errors: string[] };
type Ctx = { root: string; prisma: Prisma | null; dry: boolean; stat: Stat };
type Migrator = { table: string; file: string; run: (ctx: Ctx) => Promise<void> };

const str = (v: unknown): string | null => (v == null ? null : String(v));
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const jsonVal = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));

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

  const reportObj = { startedAt: new Date().toISOString(), dryRun: DRY, dataDir: root, backupDir, totals, tables: report };
  const dir = path.join(root, "backups");
  mkdirSync(dir, { recursive: true });
  const reportFile = path.join(dir, `${DRY ? "migration-dryrun" : "migration-report"}-${timestamp()}.json`);
  writeFileSync(reportFile, JSON.stringify(reportObj, null, 2));

  console.log(`\n📊 Total : lu ${totals.read}, ${DRY ? "à migrer" : "migré"} ${totals.migrated}, ignoré ${totals.skipped}, erreurs ${totals.errors}`);
  console.log(`📄 Rapport : ${reportFile}`);
  console.log("\nLes JSON sources n'ont PAS été supprimés.\n");

  if (prisma) await disconnectPrisma();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
