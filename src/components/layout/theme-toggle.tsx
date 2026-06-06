"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "gedify-theme";

/** Bascule thème clair / sombre (classe `.dark` sur <html>, persistée). */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Synchronise l'état React avec le thème déjà appliqué au DOM (script anti-flash
    // du layout). Lecture unique au montage → exception légitime à la règle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* localStorage indisponible → bascule en mémoire seulement */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Activer le mode clair" : "Activer le mode sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-slate-50"
      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
    >
      {dark ? <Sun className="h-4 w-4" strokeWidth={1.85} /> : <Moon className="h-4 w-4" strokeWidth={1.85} />}
    </button>
  );
}
