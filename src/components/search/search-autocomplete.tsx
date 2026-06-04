"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, Tag, Users, FileType2 } from "lucide-react";

type Suggestion = {
  kind: "document" | "tag" | "correspondent" | "document_type";
  label: string;
  value: string;
  id: number;
};

const KIND_META: Record<Suggestion["kind"], { icon: typeof Search; tag: string }> = {
  document: { icon: FileText, tag: "Document" },
  tag: { icon: Tag, tag: "Tag" },
  correspondent: { icon: Users, tag: "Correspondant" },
  document_type: { icon: FileType2, tag: "Type" },
};

/** Champ de recherche avec autocomplétion. Reste un input name="query" pour la
 *  soumission GET du formulaire ; les suggestions « document » naviguent, les
 *  autres remplissent la requête et soumettent. */
export function SearchAutocomplete({
  name = "query",
  defaultValue = "",
  placeholder = "Rechercher dans le titre et le contenu OCR",
  label = "Texte",
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
          credentials: "include",
          cache: "no-store",
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setActive(-1);
      } catch {
        /* annulé / erreur → ignore */
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(s: Suggestion) {
    setOpen(false);
    if (s.kind === "document") {
      router.push(`/documents/${s.id}`);
      return;
    }
    setValue(s.value);
    // soumettre le formulaire parent
    requestAnimationFrame(() => inputRef.current?.form?.requestSubmit());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <label className="block w-full" ref={boxRef}>
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="relative flex h-10 w-full items-center">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 h-4 w-4" style={{ color: "var(--text-muted)" }} strokeWidth={1.75} />
        <input
          ref={inputRef}
          type="search"
          name={name}
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          placeholder={placeholder}
          className="h-full w-full rounded-xl border bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        />

        {open && suggestions.length > 0 ? (
          <div className="absolute left-0 top-11 z-30 max-h-80 w-full overflow-auto rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: "var(--border)" }}>
            {suggestions.map((s, i) => {
              const Icon = KIND_META[s.kind].icon;
              return (
                <button
                  key={`${s.kind}-${s.id}`}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition ${i === active ? "bg-blue-50" : "hover:bg-slate-50"}`}
                  style={{ color: "var(--text-main)" }}
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{KIND_META[s.kind].tag}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </label>
  );
}
