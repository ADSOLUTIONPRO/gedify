"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Coins,
  Hash,
  Loader2,
  Pencil,
  Plus,
  Save,
  Tag,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import {
  DETECTED_KIND_LABEL,
  DETECTED_STATUS_LABEL,
  type DetectedInfo,
  type DetectedInfoKind,
  type DetectedInfoStatus,
} from "@/lib/ai/detected-info-types";

type Props = {
  documentId: number;
  analysisId?: string | null;
};

const FILTERS: { id: "all" | "amount" | "date" | "reference" | "org" | "category" | "validated" | "todo" | "ignored"; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "amount", label: "Montants" },
  { id: "date", label: "Dates" },
  { id: "reference", label: "Références" },
  { id: "org", label: "Organismes" },
  { id: "category", label: "Catégorie" },
  { id: "todo", label: "À traiter" },
  { id: "validated", label: "Validés" },
  { id: "ignored", label: "Ignorés" },
];

const KIND_ICONS: Partial<Record<DetectedInfoKind, typeof Coins>> = {
  amount: Coins,
  due_date: CalendarClock,
  document_date: CalendarClock,
  payment_date: CalendarClock,
  reference: Hash,
  invoice_number: Hash,
  customer_number: Hash,
  contract_number: Hash,
  organization: Users,
  person: Users,
  correspondent: Users,
  category: Tag,
  financial_type: Tag,
};

export function DetectedInfoEditableList({ documentId, analysisId }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<DetectedInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingManual, setAddingManual] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ documentId: String(documentId) });
        if (analysisId) params.set("analysisId", analysisId);
        const response = await fetch(`/api/ai/detected-infos?${params.toString()}`);
        const data = (await response.json()) as { items: DetectedInfo[] };
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [documentId, analysisId, reloadKey]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "amount":
        return items.filter((entry) => entry.kind === "amount");
      case "date":
        return items.filter((entry) =>
          ["due_date", "document_date", "payment_date", "period_start", "period_end"].includes(
            entry.kind,
          ),
        );
      case "reference":
        return items.filter((entry) =>
          ["reference", "invoice_number", "customer_number", "contract_number"].includes(
            entry.kind,
          ),
        );
      case "org":
        return items.filter((entry) =>
          ["organization", "correspondent", "person"].includes(entry.kind),
        );
      case "category":
        return items.filter((entry) =>
          ["category", "financial_type", "budget_month", "budget_year"].includes(entry.kind),
        );
      case "validated":
        return items.filter((entry) => entry.status === "validated");
      case "todo":
        return items.filter(
          (entry) => entry.status === "detected" || entry.status === "edited",
        );
      case "ignored":
        return items.filter((entry) => entry.status === "ignored");
      default:
        return items;
    }
  }, [filter, items]);

  async function action(url: string, body?: unknown, successMessage?: string) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok && response.status !== 204) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      setFeedback(successMessage ?? "Opération réussie");
      reload();
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Erreur");
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/ai/detected-infos/${pendingDeleteId}`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      setFeedback("Information supprimée");
      setPendingDeleteId(null);
      reload();
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Erreur lors de la suppression");
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-50 text-violet-600"
          >
            <Tag className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">Infos détectées</p>
            <p className="text-[11px] text-slate-500">
              {items.length} information(s) · modifiables et persistées en base.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAddingManual((v) => !v)}
          className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Ajouter manuellement
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 py-2">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setFilter(entry.id)}
            className={`inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold transition ${
              filter === entry.id
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {feedback ? (
        <p className="border-b border-slate-100 bg-emerald-50/50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
          {feedback}
        </p>
      ) : null}

      {addingManual ? (
        <ManualAddForm
          documentId={documentId}
          analysisId={analysisId ?? null}
          onClose={() => setAddingManual(false)}
          onSaved={() => {
            setAddingManual(false);
            reload();
            router.refresh();
          }}
        />
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 p-4 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-xs text-slate-500">
          Aucune information dans ce filtre.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((info) => (
            <DetectedInfoRow
              key={info.id}
              info={info}
              editing={editingId === info.id}
              onEditToggle={() => setEditingId(editingId === info.id ? null : info.id)}
              onValidate={() =>
                action(`/api/ai/detected-infos/${info.id}/validate`, undefined, "Validée")
              }
              onIgnore={() =>
                action(`/api/ai/detected-infos/${info.id}/ignore`, undefined, "Ignorée")
              }
              onConvertBudget={() =>
                action(
                  `/api/ai/detected-infos/${info.id}/convert-to-budget`,
                  {},
                  "Ajouté au budget",
                )
              }
              onConvertAction={() =>
                action(
                  `/api/ai/detected-infos/${info.id}/convert-to-action`,
                  {},
                  "Action créée",
                )
              }
              onConvertDebt={() =>
                action(
                  `/api/ai/detected-infos/${info.id}/convert-to-debt`,
                  {},
                  "Dette enregistrée",
                )
              }
              onDelete={() => setPendingDeleteId(info.id)}
              onSaved={() => {
                setEditingId(null);
                reload();
                router.refresh();
              }}
            />
          ))}
        </ul>
      )}

      <ConfirmActionDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        variant="delete"
        title="Supprimer cette information ?"
        description="Cette information détectée sera supprimée définitivement. Les données validées (budget, actions) ne sont pas affectées."
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}

type RowProps = {
  info: DetectedInfo;
  editing: boolean;
  onEditToggle: () => void;
  onValidate: () => void;
  onIgnore: () => void;
  onConvertBudget: () => void;
  onConvertAction: () => void;
  onConvertDebt: () => void;
  onDelete: () => void;
  onSaved: () => void;
};

function DetectedInfoRow({
  info,
  editing,
  onEditToggle,
  onValidate,
  onIgnore,
  onConvertBudget,
  onConvertAction,
  onConvertDebt,
  onDelete,
  onSaved,
}: RowProps) {
  const Icon = KIND_ICONS[info.kind] ?? Tag;
  const isAmount = info.kind === "amount";
  const isDate =
    info.kind === "due_date" ||
    info.kind === "document_date" ||
    info.kind === "payment_date";

  return (
    <li className="p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {DETECTED_KIND_LABEL[info.kind]}
              </p>
              <StatusBadge status={info.status} />
              {info.confidence ? <ConfidenceBadge value={info.confidence} /> : null}
              {info.isEdited ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700">
                  <Pencil className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
                  modifiée
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {info.value || "—"}
              {info.label && info.label !== info.value ? (
                <span className="ml-1 text-xs font-normal text-slate-500">· {info.label}</span>
              ) : null}
            </p>
            {info.originalValue && info.originalValue !== info.value ? (
              <p className="text-[10px] text-slate-400">
                Original IA : {info.originalValue}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onEditToggle}
          className="inline-flex h-7 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          {editing ? (
            <>
              <X className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Fermer
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Modifier
            </>
          )}
        </button>
      </div>

      {editing ? (
        <EditForm info={info} onSaved={onSaved} />
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          <Btn onClick={onValidate} icon={CheckCircle2} variant="success">
            Valider
          </Btn>
          {isAmount ? (
            <Btn onClick={onConvertBudget} icon={Coins} variant="primary">
              Ajouter au budget
            </Btn>
          ) : null}
          {isAmount ? (
            <Btn onClick={onConvertDebt} icon={Coins}>
              Comme dette
            </Btn>
          ) : null}
          {(isDate || isAmount) ? (
            <Btn onClick={onConvertAction} icon={CalendarClock}>
              Créer action
            </Btn>
          ) : null}
          <Btn onClick={onIgnore} icon={XCircle} variant="ghost">
            Ignorer
          </Btn>
          <Btn onClick={onDelete} icon={Trash2} variant="danger">
            Supprimer
          </Btn>
        </div>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: DetectedInfoStatus }) {
  const tone =
    status === "validated"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "ignored"
        ? "border-slate-200 bg-slate-100 text-slate-500"
        : status === "edited"
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : status.startsWith("converted_")
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tone}`}
    >
      {DETECTED_STATUS_LABEL[status]}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: "low" | "medium" | "high" }) {
  const tone =
    value === "high"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tone}`}
    >
      conf {value}
    </span>
  );
}

function Btn({
  onClick,
  icon: Icon,
  variant = "default",
  children,
}: {
  onClick: () => void;
  icon?: typeof CheckCircle2;
  variant?: "default" | "primary" | "success" | "ghost" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    variant === "primary"
      ? "bg-gradient-to-b from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600"
      : variant === "success"
        ? "bg-gradient-to-b from-emerald-600 to-emerald-700 text-white hover:from-emerald-500 hover:to-emerald-600"
        : variant === "ghost"
          ? "text-slate-600 hover:bg-slate-100"
          : variant === "danger"
            ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1 rounded-xl px-2.5 text-[11px] font-semibold transition ${cls}`}
    >
      {Icon ? <Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

type EditFormProps = {
  info: DetectedInfo;
  onSaved: () => void;
};

function EditForm({ info, onSaved }: EditFormProps) {
  const [value, setValue] = useState(info.value);
  const [amount, setAmount] = useState(info.amount?.toString() ?? "");
  const [currency, setCurrency] = useState(info.currency ?? "EUR");
  const [dateValue, setDateValue] = useState(info.dateValue ?? "");
  const [correspondentName, setCorrespondentName] = useState(info.correspondentName ?? "");
  const [categoryName, setCategoryName] = useState(info.categoryName ?? "");
  const [projectName, setProjectName] = useState(info.projectName ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isAmount = info.kind === "amount";
  const isDate =
    info.kind === "due_date" ||
    info.kind === "document_date" ||
    info.kind === "payment_date";

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      const body: Partial<DetectedInfo> = {
        value,
        correspondentName: correspondentName || null,
        categoryName: categoryName || null,
        projectName: projectName || null,
      };
      if (isAmount) {
        const parsed = Number.parseFloat(amount);
        if (Number.isFinite(parsed)) body.amount = parsed;
        body.currency = currency || "EUR";
        body.value = `${parsed.toFixed(2)} ${currency || "EUR"}`;
      }
      if (isDate) {
        body.dateValue = dateValue || null;
        if (dateValue) {
          const [y, m, d] = dateValue.split("-");
          body.value = `${d}/${m}/${y}`;
        }
      }
      const response = await fetch(`/api/ai/detected-infos/${info.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      onSaved();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 sm:grid-cols-2">
      {isAmount ? (
        <>
          <Field label="Montant">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Devise">
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputClass}
            />
          </Field>
        </>
      ) : isDate ? (
        <Field label="Date">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className={inputClass}
          />
        </Field>
      ) : (
        <Field label="Valeur" full>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
          />
        </Field>
      )}

      <Field label="Correspondant">
        <AutocompleteInput
          endpoint="/api/autocomplete/correspondents"
          value={correspondentName}
          onChange={(next) => setCorrespondentName(next)}
          allowCreate
          placeholder="Ex. EDF, CAF…"
        />
      </Field>
      <Field label="Catégorie">
        <AutocompleteInput
          endpoint="/api/autocomplete/budget-categories"
          value={categoryName}
          onChange={(next) => setCategoryName(next)}
          allowCreate
          placeholder="Ex. Énergie, Salaire…"
        />
      </Field>
      <Field label="Dossier / Projet" full>
        <AutocompleteInput
          endpoint="/api/autocomplete/projects"
          value={projectName}
          onChange={(next) => setProjectName(next)}
          allowCreate
          placeholder="Ex. Vente maison, Litige…"
        />
      </Field>

      {feedback ? (
        <p className="col-span-full flex items-start gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
          <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          {feedback}
        </p>
      ) : null}

      <div className="col-span-full mt-1 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-3 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Save className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          )}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function ManualAddForm({
  documentId,
  analysisId,
  onClose,
  onSaved,
}: {
  documentId: number;
  analysisId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<DetectedInfoKind>("amount");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/detected-infos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDocumentId: documentId,
          sourceAnalysisId: analysisId,
          kind,
          label: label || DETECTED_KIND_LABEL[kind],
          value,
          source: "user",
          status: "validated",
          confidence: "high",
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2 border-b border-slate-100 bg-blue-50/40 p-3 sm:grid-cols-[160px_1fr_1fr_auto]">
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as DetectedInfoKind)}
        className={inputClass}
      >
        {Object.entries(DETECTED_KIND_LABEL).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Libellé (optionnel)"
        className={inputClass}
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Valeur"
        className={inputClass}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={submit}
          disabled={saving || !value}
          className="inline-flex h-9 items-center gap-1 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          )}
          Ajouter
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
        >
          <X className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <p className="col-span-full text-[11px] font-semibold text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
