"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Plus, XCircle } from "lucide-react";
import { FormField, formInputClass } from "@/components/ui/form-field";
import type { WriterLetterType, WriterTemplate } from "@/lib/writer/types";

type Props = {
  templates: WriterTemplate[];
};

const LETTER_TYPES: { id: WriterLetterType; label: string }[] = [
  { id: "administratif", label: "Courrier administratif" },
  { id: "avocat", label: "Courrier avocat" },
  { id: "notaire", label: "Courrier notaire" },
  { id: "employeur", label: "Courrier employeur" },
  { id: "caf", label: "Courrier CAF" },
  { id: "cpam", label: "Courrier CPAM" },
  { id: "assurance", label: "Courrier assurance" },
  { id: "libre", label: "Courrier libre" },
];

export function NewDocumentForm({ templates }: Props) {
  const router = useRouter();
  const [letterType, setLetterType] = useState<WriterLetterType>("administratif");
  const [templateId, setTemplateId] = useState<string>(
    templates.find((template) => template.letterType === "administratif")?.id ?? templates[0]?.id ?? "libre",
  );
  const [title, setTitle] = useState("Nouveau courrier");
  const [recipient, setRecipient] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [reference, setReference] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTemplates = templates.filter(
    (template) => template.letterType === letterType || template.letterType === "libre",
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/writer/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          letterType,
          templateId,
          recipient,
          recipientAddress,
          subject,
          reference,
          city,
          status: "draft",
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        throw new Error(body.details ?? body.error ?? "Création impossible.");
      }
      const body = (await response.json()) as { document: { id: string } };
      router.push(`/redaction/${body.document.id}/modifier`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création impossible.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Type de courrier" required>
          <select
            value={letterType}
            onChange={(event) => {
              const value = event.target.value as WriterLetterType;
              setLetterType(value);
              const next = templates.find((template) => template.letterType === value);
              if (next) setTemplateId(next.id);
            }}
            className={formInputClass()}
          >
            {LETTER_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Modèle" hint="Tous les modèles compatibles avec le type choisi.">
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className={formInputClass()}
          >
            {filteredTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Titre interne" required hint="Tel qu'il s'affichera dans votre GED.">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={formInputClass()}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Destinataire">
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="Ex. CAF du Rhône"
            className={formInputClass()}
          />
        </FormField>
        <FormField label="Adresse destinataire">
          <input
            value={recipientAddress}
            onChange={(event) => setRecipientAddress(event.target.value)}
            placeholder="Adresse postale"
            className={formInputClass()}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Objet">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Demande d'attestation"
            className={formInputClass()}
          />
        </FormField>
        <FormField label="Référence">
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="N° dossier"
            className={formInputClass()}
          />
        </FormField>
        <FormField label="Ville">
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Lyon"
            className={formInputClass()}
          />
        </FormField>
      </div>

      {error ? (
        <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
          Créer et ouvrir l&apos;éditeur
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
