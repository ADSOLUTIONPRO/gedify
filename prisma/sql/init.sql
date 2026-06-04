-- Gedify — schéma PostgreSQL (généré depuis prisma/schema.prisma, idempotent).
-- Appliqué par: npm run gedify:db:push  (scripts/db-push.ts → init.sql via pg).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "documents" (
    "id" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "created" TIMESTAMP(3),
    "created_date" TEXT,
    "added" TIMESTAMP(3),
    "modified" TIMESTAMP(3),
    "correspondent_id" INTEGER,
    "document_type_id" INTEGER,
    "storage_path" TEXT,
    "mime_type" TEXT,
    "checksum" TEXT,
    "stored_filename" TEXT,
    "original_file_name" TEXT,
    "page_count" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_files" (
    "id" TEXT NOT NULL,
    "document_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'original',
    "filename" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "raw" JSONB,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_versions" (
    "id" TEXT NOT NULL,
    "document_id" INTEGER NOT NULL,
    "label" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_ocr" (
    "document_id" INTEGER NOT NULL,
    "content" TEXT,
    "raw" JSONB,

    CONSTRAINT "document_ocr_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_ai_analyses" (
    "id" TEXT NOT NULL,
    "document_id" INTEGER NOT NULL,
    "summary" TEXT,
    "confidence" TEXT,
    "source" TEXT,
    "analyzed_at" TIMESTAMP(3),
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_ai_suggestions" (
    "id" TEXT NOT NULL,
    "document_id" INTEGER,
    "analysis_id" TEXT,
    "suggestion_type" TEXT,
    "field_name" TEXT,
    "suggested_value" TEXT,
    "confidence" TEXT,
    "source" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tags" (
    "id" INTEGER NOT NULL,
    "name" TEXT,
    "slug" TEXT,
    "color" TEXT,
    "text_color" TEXT,
    "raw" JSONB,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_tags" (
    "document_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "document_tags_pkey" PRIMARY KEY ("document_id","tag_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_types" (
    "id" INTEGER NOT NULL,
    "name" TEXT,
    "slug" TEXT,
    "raw" JSONB,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "correspondents" (
    "id" INTEGER NOT NULL,
    "name" TEXT,
    "slug" TEXT,
    "raw" JSONB,

    CONSTRAINT "correspondents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_correspondents" (
    "document_id" INTEGER NOT NULL,
    "correspondent_id" INTEGER NOT NULL,
    "role" TEXT,

    CONSTRAINT "document_correspondents_pkey" PRIMARY KEY ("document_id","correspondent_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "folders" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT,
    "slug" TEXT,
    "color" TEXT,
    "category" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "folder_documents" (
    "folder_id" TEXT NOT NULL,
    "document_id" INTEGER NOT NULL,

    CONSTRAINT "folder_documents_pkey" PRIMARY KEY ("folder_id","document_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "budget_entries" (
    "id" TEXT NOT NULL,
    "kind" TEXT,
    "direction" TEXT,
    "label" TEXT,
    "amount" DOUBLE PRECISION,
    "amount_paid" DOUBLE PRECISION,
    "due_date" TEXT,
    "status" TEXT,
    "category_id" TEXT,
    "category_name" TEXT,
    "source_document_id" INTEGER,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "budget_payments" (
    "id" TEXT NOT NULL,
    "budget_entry_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "date" TEXT,
    "account" TEXT,
    "raw" JSONB,

    CONSTRAINT "budget_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mails" (
    "id" TEXT NOT NULL,
    "account_id" TEXT,
    "message_id" TEXT,
    "thread_id" TEXT,
    "from_addr" TEXT,
    "to_addr" TEXT,
    "subject" TEXT,
    "date" TIMESTAMP(3),
    "snippet" TEXT,
    "body" TEXT,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,

    CONSTRAINT "mails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mail_attachments" (
    "id" TEXT NOT NULL,
    "mail_id" TEXT,
    "thread_id" TEXT,
    "filename" TEXT,
    "mime_type" TEXT,
    "raw" JSONB,

    CONSTRAINT "mail_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mail_document_links" (
    "id" TEXT NOT NULL,
    "account_id" TEXT,
    "mail_id" TEXT,
    "thread_id" TEXT,
    "document_id" INTEGER,
    "filename" TEXT,
    "status" TEXT,
    "kind" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_document_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "reminders" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "remind_at" TIMESTAMP(3),
    "status" TEXT,
    "document_id" INTEGER,
    "financial_item_id" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT,
    "priority" TEXT,
    "due_date" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "signatures" (
    "id" TEXT NOT NULL,
    "scope" TEXT,
    "document_id" INTEGER,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "learned_templates" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learned_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "assistant_action_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT,
    "message" TEXT,
    "document_id" INTEGER,
    "user" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT,
    "source" TEXT,
    "message" TEXT,
    "document_id" INTEGER,
    "project_id" TEXT,
    "user" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "counters" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_title_overrides" (
    "document_id" INTEGER NOT NULL,
    "title" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_title_overrides_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "documents_correspondent_id_idx" ON "documents"("correspondent_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "documents_document_type_id_idx" ON "documents"("document_type_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "documents_deleted_idx" ON "documents"("deleted");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "documents_checksum_idx" ON "documents"("checksum");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_files_document_id_idx" ON "document_files"("document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_versions_document_id_idx" ON "document_versions"("document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_ai_analyses_document_id_idx" ON "document_ai_analyses"("document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_ai_suggestions_document_id_idx" ON "document_ai_suggestions"("document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_ai_suggestions_analysis_id_idx" ON "document_ai_suggestions"("analysis_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_tags_tag_id_idx" ON "document_tags"("tag_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_correspondents_correspondent_id_idx" ON "document_correspondents"("correspondent_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "folders_parent_id_idx" ON "folders"("parent_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "folder_documents_document_id_idx" ON "folder_documents"("document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "budget_entries_status_idx" ON "budget_entries"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "budget_entries_direction_idx" ON "budget_entries"("direction");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "budget_entries_source_document_id_idx" ON "budget_entries"("source_document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "budget_payments_budget_entry_id_idx" ON "budget_payments"("budget_entry_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mails_account_id_idx" ON "mails"("account_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mails_thread_id_idx" ON "mails"("thread_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mail_attachments_mail_id_idx" ON "mail_attachments"("mail_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mail_document_links_thread_id_idx" ON "mail_document_links"("thread_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mail_document_links_document_id_idx" ON "mail_document_links"("document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminders_document_id_idx" ON "reminders"("document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "signatures_document_id_idx" ON "signatures"("document_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "activity_logs_document_id_idx" ON "activity_logs"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

