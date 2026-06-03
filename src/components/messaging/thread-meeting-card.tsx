"use client";

import { useState } from "react";
import { CalendarClock, MapPin, Users } from "lucide-react";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { CalendarEventForm } from "@/components/messaging/calendar-event-form";
import { formatDetectedDate } from "@/lib/format";

type Meeting = {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  participants?: string[];
};

const chip = "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold transition";

/**
 * Rendez-vous détecté — bloc UNIQUE en sidebar (le doublon central est supprimé).
 * Ajouter à l'agenda / Modifier (ouvrent le formulaire) / Ignorer (masque le bloc).
 */
export function ThreadMeetingCard({
  meeting,
  subject,
  replyTo,
  confidence,
}: {
  meeting: Meeting;
  subject: string;
  replyTo: string;
  confidence?: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [ignored, setIgnored] = useState(false);
  if (ignored) return null;

  return (
    <RightRailCard title="Rendez-vous détecté" icon={CalendarClock} iconTone="blue">
      {meeting.title ? <p className="text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>{meeting.title}</p> : null}
      {meeting.date ? (
        <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{formatDetectedDate(meeting.date, meeting.time)}</p>
      ) : null}
      {meeting.location ? (
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          <MapPin className="h-3 w-3" strokeWidth={2} /> {meeting.location}
        </p>
      ) : null}
      {meeting.participants?.length ? (
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          <Users className="h-3 w-3" strokeWidth={2} /> {meeting.participants.join(", ")}
        </p>
      ) : null}
      <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--text-hint)" }}>
        Détecté par l&apos;IA{confidence ? ` · confiance ${confidence}` : ""}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setShowForm(true)} className={chip} style={{ borderColor: "var(--accent)", color: "#fff", background: "var(--accent)" }}>
          <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} /> Ajouter à l&apos;agenda
        </button>
        <button type="button" onClick={() => setShowForm(true)} className={chip} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Modifier</button>
        <button type="button" onClick={() => setIgnored(true)} className={chip} style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Ignorer</button>
      </div>

      {showForm ? (
        <div className="mt-2">
          <CalendarEventForm
            initialTitle={meeting.title ?? subject}
            initialDate={meeting.date}
            initialTime={meeting.time}
            initialLocation={meeting.location}
            initialDescription={meeting.description ?? `Email source : ${subject}`}
            initialAttendees={meeting.participants ?? (replyTo ? [replyTo] : [])}
            onClose={() => setShowForm(false)}
          />
        </div>
      ) : null}
    </RightRailCard>
  );
}
