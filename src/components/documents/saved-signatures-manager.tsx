"use client";

import { useEffect, useState } from "react";
import { Loader2, PenLine, Trash2 } from "lucide-react";
import { SignaturePad } from "@/components/documents/signature-pad";

type Kind = "signature" | "paraphe";
type Saved = { id: string; kind: Kind; name: string; dataUrl: string; createdAt: string };

/**
 * Gestion des signatures & paraphes enregistrés (paramètres espace Documents) :
 * liste (vignettes), création (dessin/import/texte), suppression.
 */
export function SavedSignaturesManager() {
  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>("signature");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/documents/signatures", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { signatures: [] }))
      .then((d: { signatures?: Saved[] }) => setItems(d.signatures ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(dataUrl: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/documents/signatures", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name: name.trim() || undefined, dataUrl }),
      });
      if (!res.ok) throw new Error();
      const { signature } = (await res.json()) as { signature: Saved };
      setItems((prev) => [signature, ...prev]);
      setName("");
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/documents/signatures/${id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
  }

  const signatures = items.filter((s) => s.kind === "signature");
  const paraphes = items.filter((s) => s.kind === "paraphe");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Listes */}
      <div className="space-y-5">
        <Group title="Signatures enregistrées" items={signatures} loading={loading} onRemove={remove} />
        <Group title="Paraphes enregistrés" items={paraphes} loading={loading} onRemove={remove} />
      </div>

      {/* Création */}
      <div className="space-y-3">
        <div className="rounded-2xl border bg-white p-3" style={{ borderColor: "var(--border)" }}>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Nouvelle signature / paraphe</p>
          <div className="mb-2 flex gap-1">
            {(["signature", "paraphe"] as Kind[]).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className="flex-1 rounded-lg py-1.5 text-[12px] font-bold capitalize transition"
                style={{ background: kind === k ? "var(--accent-soft)" : "transparent", color: kind === k ? "var(--accent)" : "var(--text-muted)" }}>
                {k}
              </button>
            ))}
          </div>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "paraphe" ? "Nom (ex. Initiales)" : "Nom (ex. Signature pro)"}
            className="mb-2 h-9 w-full rounded-lg border px-3 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
          <SignaturePad defaultText="" onGenerate={(d) => void save(d)} ctaLabel={saving ? "Enregistrement…" : "Enregistrer"} />
          {error ? <p className="mt-1.5 text-[12px] font-semibold" style={{ color: "var(--danger)" }}>{error}</p> : null}
        </div>
        <p className="px-1 text-[11px] leading-snug" style={{ color: "var(--text-hint)" }}>
          Ces signatures et paraphes sont réutilisables lors de la signature d&apos;un PDF. Signature visuelle uniquement (pas de valeur eIDAS certifiée).
        </p>
      </div>
    </div>
  );
}

function Group({ title, items, loading, onRemove }: { title: string; items: Saved[]; loading: boolean; onRemove: (id: string) => void }) {
  return (
    <section className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <h2 className="mb-3 text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>{title}</h2>
      {loading ? (
        <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}><PenLine className="h-4 w-4" strokeWidth={1.75} /> Aucune entrée — créez-en une à droite.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((s) => (
            <div key={s.id} className="group relative flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.dataUrl} alt={s.name} className="h-12 w-24 shrink-0 object-contain" style={{ background: "#FCFAF7" }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{s.name}</span>
              <button type="button" onClick={() => onRemove(s.id)} aria-label="Supprimer" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
