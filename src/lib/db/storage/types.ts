/**
 * Abstraction de stockage de Gedify. Permet une bascule progressive
 * json → postgres → sqlite sans réécrire les appelants.
 *
 * Pour l'instant : interface volontairement proche de `readStore/writeStore`
 * (collections nommées). La normalisation fine en tables Postgres se fera via
 * des repositories dédiés dans une phase ultérieure — l'app continue d'utiliser
 * le JSON tant que GEDIFY_STORAGE_MODE=json.
 */

export type StorageMode = "json" | "postgres" | "sqlite";

export interface StorageProvider {
  readonly mode: StorageMode;
  read<T>(name: string, fallback: T): Promise<T>;
  write<T>(name: string, data: T): Promise<void>;
}
