"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { CreateCalendarItemModal, type CalendarItemSource } from "@/components/calendar/create-calendar-item-modal";

/** Bouton « Nouveau RDV / Nouvelle tâche » → ouvre la modale de création. */
export function CreateCalendarItemButton({
  source = { sourceType: "manual" },
  className,
  label = "Nouveau RDV / Tâche",
}: {
  source?: CalendarItemSource;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"}
        style={className ? undefined : { background: "var(--accent)" }}
      >
        <CalendarPlus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        {label}
      </button>
      {open ? <CreateCalendarItemModal source={source} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
