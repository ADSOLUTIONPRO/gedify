"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Bold, Italic, Link2, List, ListOrdered } from "lucide-react";

function ToolBtn({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      // onMouseDown au lieu d'onClick : évite de perdre la sélection du texte.
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
    >
      {children}
    </button>
  );
}

/**
 * Éditeur richtext léger (contenteditable + execCommand) sans dépendance :
 * gras, italique, listes, lien. Émet le HTML via `onChange`.
 */
export function RichTextEditor({
  initialHtml = "",
  onChange,
  placeholder,
  minHeight = 150,
}: {
  initialHtml?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && initialHtml) ref.current.innerHTML = initialHtml;
    // initialisation unique
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("Adresse du lien :", "https://");
    if (url) exec("createLink", url);
  }

  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1" style={{ borderColor: "var(--border)" }}>
        <ToolBtn onClick={() => exec("bold")} label="Gras"><Bold className="h-3.5 w-3.5" strokeWidth={2.25} /></ToolBtn>
        <ToolBtn onClick={() => exec("italic")} label="Italique"><Italic className="h-3.5 w-3.5" strokeWidth={2.25} /></ToolBtn>
        <ToolBtn onClick={() => exec("insertUnorderedList")} label="Liste à puces"><List className="h-3.5 w-3.5" strokeWidth={2} /></ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} label="Liste numérotée"><ListOrdered className="h-3.5 w-3.5" strokeWidth={2} /></ToolBtn>
        <ToolBtn onClick={addLink} label="Lien"><Link2 className="h-3.5 w-3.5" strokeWidth={2} /></ToolBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? "Corps du message"}
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        data-placeholder={placeholder ?? ""}
        className="max-w-none overflow-y-auto px-3 py-2 text-[13px] leading-6 outline-none [&:empty:before]:text-slate-400 [&:empty:before]:content-[attr(data-placeholder)]"
        style={{ minHeight, maxHeight: 260, color: "var(--text-main)" }}
      />
    </div>
  );
}
