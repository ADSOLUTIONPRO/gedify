export type PaperlessResource = {
  id?: number | string;
  name?: string;
  title?: string;
  slug?: string;
  email?: string;
  document_count?: number;
  user_can_change?: boolean;
  [key: string]: unknown;
};

export type NormalizedPaperlessCollection = {
  count: number;
  results: PaperlessResource[];
  next?: string | null;
  previous?: string | null;
  raw: unknown;
};

export type PaperlessResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export type ResourceField = {
  key: string;
  label: string;
};
