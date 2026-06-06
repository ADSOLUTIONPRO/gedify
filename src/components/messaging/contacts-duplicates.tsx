"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Loader2 } from "lucide-react";

type Contact = {
  resourceName: string;
  displayName: string;
  email: string | null;
  source: string;
  correspondentId: number | null;
};
type Group = { key: string; contacts: Contact[] };

const SOURCE_LABEL: Record<string, string> = {
  people: "Google", other_contacts: "Google", imap_email: "Email", manual: "Manuel",
};

/** Doublons par email : choisir le contact à conserver puis fusionner (confirmation). */
export function ContactsDuplicates({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const [keepByKey, setKeepByKey] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function merge(group: Group) {
    const keep = keepByKey[group.key] ?? group.contacts[0].resourceName;
    const drop = group.contacts.map((c) => c.resourceName).filter((r) => r !== keep);
    if (drop.length === 0) return;
    setBusy(group.key);
    try {
      const res = await fetch("/api/contacts/merge", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep, drop }),
      });
      if (res.ok) router.refresh();
    } finally { setBusy(null); }
  }

  if (groups.length === 0) {
    return <p className="px-1 py-6 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Aucun doublon détecté (par adresse email).</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const keep = keepByKey[group.key] ?? group.contacts[0].resourceName;
        return (
          <div key={group.key} className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
            <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
              {group.contacts.length} contacts partagent <span className="font-mono">{group.key}</span>
            </p>
            <div className="space-y-1.5">
              {group.contacts.map((c) => (
                <label key={c.resourceName} className="flex items-center gap-2 text-[13px]">
                  <input type="radio" name={`keep-${group.key}`} checked={keep === c.resourceName} onChange={() => setKeepByKey((m) => ({ ...m, [group.key]: c.resourceName }))} />
                  <span className="font-semibold" style={{ color: "var(--text-main)" }}>{c.displayName}</span>
                  <span style={{ color: "var(--text-muted)" }}>{c.email}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">{SOURCE_LABEL[c.source] ?? c.source}</span>
                  {c.correspondentId ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">lié</span> : null}
                </label>
              ))}
            </div>
            <button type="button" disabled={busy === group.key} onClick={() => void merge(group)} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-white disabled:opacity-50" style={{ background: "var(--blue-600)" }}>
              {busy === group.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />} Fusionner (garder le sélectionné)
            </button>
          </div>
        );
      })}
    </div>
  );
}
