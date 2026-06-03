"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

export type Recipient = { email: string; name?: string };

type Suggestion = { name: string; email: string; source: "google" | "linked"; correspondentId: number | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initials(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, " ").trim().slice(0, 2).toUpperCase() || "?";
}

/**
 * Champ destinataire intelligent : chips multi-destinataires + autocomplétion
 * (contacts Google / correspondants liés via /api/messaging/recipients/search).
 * Saisie libre validée par Entrée / virgule si c'est un email valide.
 */
export function RecipientInput({
  value,
  onChange,
  placeholder,
}: {
  value: Recipient[];
  onChange: (recipients: Recipient[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = input.trim();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (q.length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      try {
        const res = await fetch(`/api/messaging/recipients/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        const sugg = (data.suggestions ?? []).filter((s) => !value.some((v) => v.email.toLowerCase() === s.email.toLowerCase()));
        setSuggestions(sugg);
        setOpen(sugg.length > 0);
        setActive(0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [input, value]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function add(r: Recipient) {
    if (!r.email) return;
    if (!value.some((v) => v.email.toLowerCase() === r.email.toLowerCase())) onChange([...value, r]);
    setInput("");
    setSuggestions([]);
    setOpen(false);
  }
  function addRaw() {
    const email = input.trim().replace(/[,;]$/, "").trim();
    if (EMAIL_RE.test(email)) add({ email });
  }
  function remove(email: string) {
    onChange(value.filter((v) => v.email !== email));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      if (open && suggestions[active]) add({ email: suggestions[active].email, name: suggestions[active].name });
      else addRaw();
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      remove(value[value.length - 1].email);
    } else if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex flex-wrap items-center gap-1">
        {value.map((r) => (
          <span key={r.email} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent-active)" }} title={r.email}>
            <span className="max-w-[160px] truncate">{r.name ?? r.email}</span>
            <button type="button" onClick={() => remove(r.email)} aria-label={`Retirer ${r.email}`} className="opacity-70 hover:opacity-100">
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addRaw()}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[140px] flex-1 bg-transparent text-[13px] outline-none"
          style={{ color: "var(--text-main)" }}
        />
      </div>

      {open && suggestions.length > 0 ? (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: "var(--border)" }}>
          {suggestions.map((s, i) => (
            <li key={s.email}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); add({ email: s.email, name: s.name }); }}
                onMouseEnter={() => setActive(i)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
                style={{ background: i === active ? "var(--accent-soft)" : "transparent" }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "var(--accent)" }}>
                  {initials(s.name || s.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{s.name}</span>
                  <span className="block truncate text-[11px]" style={{ color: "var(--text-hint)" }}>
                    {s.email} · {s.source === "linked" ? "Contact lié à un correspondant GED" : "Google Contact"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
