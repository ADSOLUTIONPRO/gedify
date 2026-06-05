export type PaperlessId = number;

export type PaperlessListResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
  all?: PaperlessId[];
};

export type PaperlessSearchHit = {
  score?: number;
  highlights?: string;
  rank?: number;
  /** Extrait OCR surligné (HTML avec <mark>) autour des termes recherchés. */
  snippet?: string;
};

export type PaperlessNote = {
  id: number;
  note: string;
  created?: string;
  user?: unknown;
};

export type PaperlessDocument = {
  id: PaperlessId;
  title: string;
  content?: string;
  created?: string | null;
  created_date?: string | null;
  added?: string | null;
  modified?: string | null;
  correspondent?: PaperlessId | null;
  correspondent__name?: string | null;
  document_type?: PaperlessId | null;
  document_type__name?: string | null;
  storage_path?: PaperlessId | null;
  storage_path__name?: string | null;
  tags?: PaperlessId[];
  archive_serial_number?: number | string | null;
  original_file_name?: string | null;
  archived_file_name?: string | null;
  filename?: string | null;
  archive_filename?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  page_count?: number | null;
  notes?: PaperlessNote[];
  owner?: PaperlessId | null;
  user_can_change?: boolean;
  /** Statut + code d'erreur de la miniature (diagnostic vignette, moteur autonome). */
  thumbnail_status?: string | null;
  thumbnail_error?: string | null;
  __search_hit__?: PaperlessSearchHit;
};

export type PaperlessCorrespondent = {
  id: PaperlessId;
  name: string;
  slug?: string;
  match?: string;
  matching_algorithm?: number;
  is_insensitive?: boolean;
  document_count?: number;
  owner?: PaperlessId | null;
  user_can_change?: boolean;
};

export type PaperlessDocumentType = {
  id: PaperlessId;
  name: string;
  slug?: string;
  match?: string;
  matching_algorithm?: number;
  is_insensitive?: boolean;
  document_count?: number;
  owner?: PaperlessId | null;
  user_can_change?: boolean;
};

export type PaperlessTag = {
  id: PaperlessId;
  name: string;
  slug?: string;
  color?: string;
  text_color?: string;
  match?: string;
  matching_algorithm?: number;
  is_insensitive?: boolean;
  is_inbox_tag?: boolean;
  document_count?: number;
  owner?: PaperlessId | null;
  user_can_change?: boolean;
};

export type PaperlessDocumentPatch = {
  title?: string;
  correspondent?: PaperlessId | null;
  document_type?: PaperlessId | null;
  tags?: PaperlessId[];
  created?: string | null;
  archive_serial_number?: number | string | null;
  notes?: PaperlessNote[] | string | null;
};

export type PaperlessProfile = {
  email?: string;
  first_name?: string;
  last_name?: string;
  has_usable_password?: boolean;
  is_mfa_enabled?: boolean;
};

export type PaperlessStatistics = {
  documents_total?: number;
  documents_inbox?: number | null;
  tag_count?: number;
  correspondent_count?: number;
  document_type_count?: number;
  storage_path_count?: number;
  character_count?: number;
  current_asn?: number;
};

export type PaperlessSystemStatus = {
  pngx_version?: string;
  install_type?: string;
  server_os?: string;
  storage?: {
    total?: number;
    available?: number;
  };
  database?: {
    type?: string;
    status?: string;
    error?: string | null;
    migration_status?: {
      latest_migration?: string;
      unapplied_migrations?: string[];
    };
  };
  tasks?: {
    redis_status?: string;
    celery_status?: string;
    index_status?: string;
    classifier_status?: string;
    sanity_check_status?: string;
    sanity_check_error?: string | null;
  };
};

export type PaperlessStatus = {
  connected: boolean;
  url: string | null;
  version?: string | null;
  updateAvailable?: boolean | null;
  apiVersion?: string | null;
  user?: PaperlessProfile | null;
  statistics?: PaperlessStatistics | null;
  system?: PaperlessSystemStatus | null;
  error?: string;
};

/** Tâche Paperless telle que retournée par /api/tasks/ */
export type PaperlessTask = {
  id: string | number;
  task_id: string;
  task_file_name: string | null;
  date_created: string;
  date_done: string | null;
  type: string | null;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "REVOKED" | string;
  result: string | null;
  acknowledged: boolean;
  related_document: number | null;
};
