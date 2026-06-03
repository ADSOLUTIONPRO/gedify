import "server-only";

import {
  readStore,
  STORE,
  type EngineDocument,
  type EngineNamed,
  type EngineObject,
  type EngineTag,
} from "./stores";
import type { PaperlessStatistics, PaperlessSystemStatus } from "@/lib/paperless-types";

export const ENGINE_VERSION = "gedify-engine-1.0";

/* État synthétique « moteur OK » (remplace /api/statistics/ et /api/status/). */

export async function getStatistics(): Promise<PaperlessStatistics> {
  const [docs, tags, corr, types, paths] = await Promise.all([
    readStore<EngineDocument[]>(STORE.documents, []),
    readStore<EngineTag[]>(STORE.tags, []),
    readStore<EngineNamed[]>(STORE.correspondents, []),
    readStore<EngineNamed[]>(STORE.document_types, []),
    readStore<EngineObject[]>(STORE.storage_paths, []),
  ]);
  const live = docs.filter((d) => !d.deleted);
  const inboxTagIds = new Set(tags.filter((t) => t.is_inbox_tag).map((t) => t.id));
  const inbox = live.filter((d) => (d.tags ?? []).some((t) => inboxTagIds.has(t))).length;
  const character_count = live.reduce((sum, d) => sum + (d.content?.length ?? 0), 0);
  return {
    documents_total: live.length,
    documents_inbox: inbox,
    tag_count: tags.length,
    correspondent_count: corr.length,
    document_type_count: types.length,
    storage_path_count: paths.length,
    character_count,
    current_asn: 0,
  };
}

export function getSystemStatus(): PaperlessSystemStatus {
  return {
    pngx_version: ENGINE_VERSION,
    install_type: "gedify-nopp",
    server_os: `${process.platform} ${process.arch}`,
    database: {
      type: "json-store",
      status: "OK",
      error: null,
      migration_status: { latest_migration: "engine", unapplied_migrations: [] },
    },
    tasks: {
      redis_status: "OK",
      celery_status: "OK",
      index_status: "OK",
      classifier_status: "OK",
      sanity_check_status: "OK",
      sanity_check_error: null,
    },
  };
}

export function getRemoteVersion() {
  return { version: ENGINE_VERSION, update_available: false };
}
