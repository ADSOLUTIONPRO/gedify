"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { FormCard } from "@/components/ui/form-card";
import { FormField, formInputClass } from "@/components/ui/form-field";
import type {
  MailAttachmentFilter,
  MailEncryption,
  MailProvider,
  MailTestResult,
} from "@/lib/mail-connector/types";

type WizardStep = 1 | 2 | 3 | 4 | 5;

type Draft = {
  provider: MailProvider | null;
  name: string;
  email: string;
  username: string;
  password: string;
  imapHost: string;
  imapPort: number;
  encryption: MailEncryption;
  smtpHost: string;
  smtpPort: number;
  smtpEncryption: MailEncryption;
  watchedFolder: string;
  syncIntervalMinutes: number;
  markAsRead: boolean;
  ignoreAlreadyRead: boolean;
  deleteAfterImport: boolean;
  attachmentFilter: MailAttachmentFilter;
};

type ConnectMailWizardProps = {
  providers: MailProvider[];
  initialProvider: string | null;
  secureStorageReady: boolean;
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Fournisseur" },
  { id: 2, label: "Configuration" },
  { id: 3, label: "Options" },
  { id: 4, label: "Test" },
  { id: 5, label: "Enregistrement" },
];

export function ConnectMailWizard({
  providers,
  initialProvider,
  secureStorageReady,
}: ConnectMailWizardProps) {
  const router = useRouter();
  const initialMatch = useMemo(
    () => providers.find((provider) => provider.id === initialProvider) ?? null,
    [providers, initialProvider],
  );

  const [step, setStep] = useState<WizardStep>(initialMatch ? 2 : 1);
  const [draft, setDraft] = useState<Draft>(() => buildInitialDraft(initialMatch));
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState<MailTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<string | null>(null);

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  /** Auto-détecte le serveur IMAP depuis l'adresse email (table intégrée → ISPDB
   *  Mozilla → repli imap.<domaine>). Préremplit hôte/port/chiffrement. */
  async function autodetect(email: string) {
    if (!email.includes("@") || !email.split("@")[1]?.includes(".")) return;
    setDetecting(true);
    setDetectMsg(null);
    try {
      const res = await fetch(`/api/mail-connector/autodetect?email=${encodeURIComponent(email.trim())}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json()) as {
        detect?: {
          imapHost: string; imapPort: number; encryption: MailEncryption;
          smtpHost?: string; smtpPort?: number; smtpEncryption?: MailEncryption;
          source: string;
        };
      };
      if (res.ok && body.detect) {
        updateDraft({
          imapHost: body.detect.imapHost,
          imapPort: body.detect.imapPort,
          encryption: body.detect.encryption,
          ...(body.detect.smtpHost ? { smtpHost: body.detect.smtpHost } : {}),
          ...(body.detect.smtpPort ? { smtpPort: body.detect.smtpPort } : {}),
          ...(body.detect.smtpEncryption ? { smtpEncryption: body.detect.smtpEncryption } : {}),
        });
        setDetectMsg(
          body.detect.source === "guess"
            ? "Réglages estimés (imap./smtp.<domaine>) — vérifiez puis testez la connexion."
            : "Serveurs IMAP et SMTP détectés automatiquement.",
        );
      }
    } catch {
      /* silencieux : l'utilisateur peut saisir manuellement */
    } finally {
      setDetecting(false);
    }
  }

  function selectProvider(provider: MailProvider) {
    setDraft({
      provider,
      name: provider.name + " principal",
      email: "",
      username: "",
      password: "",
      imapHost: provider.defaultImapHost ?? "",
      imapPort: provider.defaultImapPort,
      encryption: provider.defaultEncryption,
      smtpHost: provider.defaultImapHost ? provider.defaultImapHost.replace(/^imap\./i, "smtp.") : "",
      smtpPort: 465,
      smtpEncryption: "tls",
      watchedFolder: "INBOX",
      syncIntervalMinutes: 30,
      markAsRead: true,
      ignoreAlreadyRead: true,
      deleteAfterImport: false,
      attachmentFilter: "pdf-only",
    });
    setStep(2);
    setTestResult(null);
  }

  async function runTest(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.provider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/mail-connector/test-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imapHost: draft.imapHost,
          imapPort: draft.imapPort,
          encryption: draft.encryption,
          username: draft.username || draft.email,
          watchedFolder: draft.watchedFolder,
          password: draft.password,
        }),
      });
      const body = (await response.json()) as { result?: MailTestResult; error?: string };
      if (body.result) {
        setTestResult(body.result);
      } else {
        setTestResult({
          ok: false,
          code: "unknown",
          message: body.error ?? "Test impossible.",
          durationMs: 0,
        });
      }
    } catch (error) {
      setTestResult({
        ok: false,
        code: "unknown",
        message: error instanceof Error ? error.message : "Test impossible.",
        durationMs: 0,
      });
    } finally {
      setTesting(false);
    }
  }

  async function saveAccount() {
    if (!draft.provider) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/mail-connector/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          provider: draft.provider.id,
          authType: "imap-password",
          imapHost: draft.imapHost,
          imapPort: draft.imapPort,
          encryption: draft.encryption,
          smtpHost: draft.smtpHost,
          smtpPort: draft.smtpPort,
          smtpEncryption: draft.smtpEncryption,
          smtpUsername: draft.username || draft.email,
          username: draft.username || draft.email,
          password: secureStorageReady ? draft.password : null,
          watchedFolder: draft.watchedFolder,
          syncIntervalMinutes: draft.syncIntervalMinutes,
          markAsRead: draft.markAsRead,
          ignoreAlreadyRead: draft.ignoreAlreadyRead,
          deleteAfterImport: draft.deleteAfterImport,
          attachmentFilter: draft.attachmentFilter,
          isActive: testResult?.ok ?? false,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(body.details ?? body.error ?? "Création impossible.");
      }
      await response.json().catch(() => ({}));
      // Retour sur la boîte (et non l'écran d'ajout/compte) : l'utilisateur voit sa messagerie.
      router.push("/messagerie");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Création impossible.");
      setSaving(false);
    }
  }

  const canAdvance =
    step === 1
      ? Boolean(draft.provider)
      : step === 2
        ? Boolean(draft.email && draft.imapHost && (draft.username || draft.email) && draft.password)
        : true;

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Étapes
        </p>
        {STEPS.map((s) => {
          const isCurrent = s.id === step;
          const isDone = s.id < step;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => (s.id < step ? setStep(s.id) : null)}
              disabled={s.id > step}
              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition ${
                isCurrent
                  ? "border-blue-300 bg-blue-50 text-blue-900 shadow-sm"
                  : isDone
                    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-transparent bg-white/40 text-slate-400"
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  isCurrent
                    ? "bg-blue-600 text-white"
                    : isDone
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} /> : s.id}
              </span>
              <span className="font-semibold">{s.label}</span>
            </button>
          );
        })}
        {!secureStorageReady ? (
          <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3 text-xs leading-5 text-amber-800">
            <p className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Stockage sécurisé à connecter
            </p>
            <p className="mt-1">
              Le mot de passe ne sera pas enregistré tant que <code className="font-mono">MAIL_CONNECTOR_KEY</code> n&apos;est pas défini.
            </p>
          </div>
        ) : null}
      </aside>

      <section className="space-y-6">
        {step === 1 ? (
          <FormCard
            icon={Mail}
            title="Choisissez votre fournisseur"
            description="Sélectionnez l'origine de la boîte mail à connecter."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providers.map((provider) => (
                <button
                  type="button"
                  key={provider.id}
                  onClick={() => selectProvider(provider)}
                  className={`flex h-full flex-col rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md ${
                    draft.provider?.id === provider.id
                      ? "border-blue-300 bg-blue-50/60"
                      : "border-slate-200 bg-white/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">{provider.name}</p>
                    {provider.status === "preview" ? (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        OAuth à connecter
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        IMAP
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{provider.description}</p>
                  {provider.notes.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-[11px] text-slate-500">
                      {provider.notes.map((note) => (
                        <li key={note}>· {note}</li>
                      ))}
                    </ul>
                  ) : null}
                </button>
              ))}
            </div>
          </FormCard>
        ) : null}

        {step === 2 && draft.provider ? (
          <FormCard
            icon={Mail}
            title="Configurer le compte"
            description={`Identifiants ${draft.provider.name}. Les secrets restent côté serveur.`}
          >
            <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
              <FormField label="Nom interne" hint="Comment vous nommez ce compte dans la GED." required>
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  className={formInputClass()}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Adresse email" hint="À la sortie du champ, le serveur IMAP est détecté automatiquement." required>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) => updateDraft({ email: e.target.value, username: e.target.value })}
                    onBlur={(e) => void autodetect(e.target.value)}
                    placeholder="vous@example.com"
                    className={formInputClass()}
                  />
                </FormField>
                <FormField label="Identifiant IMAP" hint="Souvent l'adresse email complète.">
                  <input
                    value={draft.username}
                    onChange={(e) => updateDraft({ username: e.target.value })}
                    className={formInputClass()}
                  />
                </FormField>
              </div>
              <FormField
                label="Mot de passe ou mot de passe d'application"
                required
                hint="Stocké chiffré (AES-256-GCM) si MAIL_CONNECTOR_KEY est défini. Jamais renvoyé au client."
              >
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={draft.password}
                    onChange={(e) => updateDraft({ password: e.target.value })}
                    autoComplete="new-password"
                    className={formInputClass({ className: "pr-12" })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Masquer" : "Afficher"}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </FormField>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void autodetect(draft.email)}
                  disabled={detecting || !draft.email.includes("@")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  {detecting ? "Détection…" : "Détecter le serveur automatiquement"}
                </button>
                {detectMsg ? <span className="text-xs font-semibold text-emerald-700">{detectMsg}</span> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Serveur IMAP" required>
                  <input
                    value={draft.imapHost}
                    onChange={(e) => updateDraft({ imapHost: e.target.value })}
                    className={formInputClass()}
                  />
                </FormField>
                <FormField label="Port" required>
                  <input
                    type="number"
                    value={draft.imapPort}
                    onChange={(e) => updateDraft({ imapPort: Number(e.target.value) })}
                    className={formInputClass()}
                  />
                </FormField>
                <FormField label="Chiffrement">
                  <select
                    value={draft.encryption}
                    onChange={(e) => updateDraft({ encryption: e.target.value as MailEncryption })}
                    className={formInputClass()}
                  >
                    <option value="tls">SSL / TLS</option>
                    <option value="starttls">STARTTLS</option>
                    <option value="none">Aucun (déconseillé)</option>
                  </select>
                </FormField>

                {/* SMTP (envoi) — prérempli par la détection, modifiable. */}
                <div className="sm:col-span-2 mt-1 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
                  Envoi (SMTP)
                </div>
                <FormField label="Serveur SMTP">
                  <input
                    value={draft.smtpHost}
                    onChange={(e) => updateDraft({ smtpHost: e.target.value })}
                    className={formInputClass()}
                  />
                </FormField>
                <FormField label="Port SMTP">
                  <input
                    type="number"
                    value={draft.smtpPort}
                    onChange={(e) => updateDraft({ smtpPort: Number(e.target.value) })}
                    className={formInputClass()}
                  />
                </FormField>
                <FormField label="Chiffrement SMTP">
                  <select
                    value={draft.smtpEncryption}
                    onChange={(e) => updateDraft({ smtpEncryption: e.target.value as MailEncryption })}
                    className={formInputClass()}
                  >
                    <option value="tls">SSL / TLS</option>
                    <option value="starttls">STARTTLS</option>
                    <option value="none">Aucun (déconseillé)</option>
                  </select>
                </FormField>
                <div className="sm:col-span-2 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                  Ces informations sont dans les paramètres de votre fournisseur. Le mot de passe d’envoi
                  réutilise celui de la réception (un mot de passe d’application peut être requis).
                </div>
              </div>
            </form>
          </FormCard>
        ) : null}

        {step === 3 ? (
          <FormCard
            icon={Sparkles}
            title="Options de synchronisation"
            description="Comment Gedify doit traiter les emails de cette boîte."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Dossier surveillé" hint="INBOX par défaut, ou un sous-dossier.">
                <input
                  value={draft.watchedFolder}
                  onChange={(e) => updateDraft({ watchedFolder: e.target.value })}
                  className={formInputClass()}
                />
              </FormField>
              <FormField label="Fréquence (minutes)" hint="Intervalle entre deux synchronisations.">
                <input
                  type="number"
                  min={5}
                  value={draft.syncIntervalMinutes}
                  onChange={(e) =>
                    updateDraft({ syncIntervalMinutes: Math.max(5, Number(e.target.value)) })
                  }
                  className={formInputClass()}
                />
              </FormField>
              <FormField label="Pièces jointes à importer">
                <select
                  value={draft.attachmentFilter}
                  onChange={(e) =>
                    updateDraft({ attachmentFilter: e.target.value as MailAttachmentFilter })
                  }
                  className={formInputClass()}
                >
                  <option value="pdf-only">PDF uniquement (recommandé)</option>
                  <option value="all-compatible">
                    Toutes les pièces jointes compatibles (PDF, images, Office, EML…)
                  </option>
                </select>
              </FormField>
              <div className="space-y-2">
                <Toggle
                  checked={draft.ignoreAlreadyRead}
                  onChange={(value) => updateDraft({ ignoreAlreadyRead: value })}
                  label="Ignorer les emails déjà lus"
                  hint="Recommandé pour ne traiter que les nouveaux messages."
                />
                <Toggle
                  checked={draft.markAsRead}
                  onChange={(value) => updateDraft({ markAsRead: value })}
                  label="Marquer comme lu après import"
                />
                <Toggle
                  checked={draft.deleteAfterImport}
                  onChange={(value) => updateDraft({ deleteAfterImport: value })}
                  label="Supprimer l'email après import"
                  hint="Désactivé par défaut. À utiliser avec précaution."
                />
              </div>
            </div>
          </FormCard>
        ) : null}

        {step === 4 ? (
          <FormCard
            icon={ShieldCheck}
            title="Tester la connexion"
            description="Connexion IMAP en direct depuis le serveur Next.js. Le mot de passe n'est jamais renvoyé au navigateur."
            footer={
              testResult ? (
                <div
                  className={`flex items-start gap-2 text-xs font-semibold ${
                    testResult.ok ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <XCircle className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  )}
                  <span>
                    {testResult.message}
                    {testResult.folders && testResult.folders.length > 0 ? (
                      <span className="ml-1 font-normal text-slate-500">
                        ({testResult.folders.length} dossiers détectés)
                      </span>
                    ) : null}
                  </span>
                </div>
              ) : null
            }
          >
            <p className="text-sm text-slate-600">
              Cliquez sur <strong>Tester</strong> pour valider l&apos;hôte, le port, le chiffrement et
              l&apos;identifiant. Le serveur tente une vraie connexion IMAP avec votre mot de passe.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={(event) => runTest(event)}
                disabled={testing}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
              >
                {testing ? "Test en cours..." : "Tester la connexion"}
              </button>
            </div>
          </FormCard>
        ) : null}

        {step === 5 ? (
          <FormCard
            icon={CheckCircle2}
            title="Résumé"
            description="Vérifiez les informations avant enregistrement."
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <Summary label="Fournisseur" value={draft.provider?.name ?? "—"} />
              <Summary label="Nom interne" value={draft.name} />
              <Summary label="Email" value={draft.email} />
              <Summary label="Identifiant" value={draft.username || draft.email} />
              <Summary label="Serveur IMAP" value={`${draft.imapHost}:${draft.imapPort}`} />
              <Summary label="Chiffrement" value={draft.encryption.toUpperCase()} />
              <Summary label="Dossier surveillé" value={draft.watchedFolder} />
              <Summary
                label="Pièces jointes"
                value={draft.attachmentFilter === "pdf-only" ? "PDF uniquement" : "Toutes compatibles"}
              />
              <Summary label="Test" value={testResult?.ok ? "Succès" : testResult ? "Échec" : "Non effectué"} />
              <Summary
                label="Stockage mot de passe"
                value={secureStorageReady ? "Chiffré AES-256-GCM" : "À connecter (non enregistré)"}
              />
            </dl>
            {saveError ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <XCircle className="mt-0.5 h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {saveError}
              </p>
            ) : null}
          </FormCard>
        ) : null}

        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1) as WizardStep)}
            disabled={step === 1}
            className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Précédent
          </button>
          {step < 5 ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep((current) => (Math.min(5, current + 1)) as WizardStep)}
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
            >
              Suivant
              <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={saveAccount}
              disabled={saving}
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)] transition hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60"
            >
              {saving ? "Enregistrement..." : "Enregistrer le compte"}
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function buildInitialDraft(provider: MailProvider | null): Draft {
  return {
    provider,
    name: provider ? `${provider.name} principal` : "",
    email: "",
    username: "",
    password: "",
    imapHost: provider?.defaultImapHost ?? "",
    imapPort: provider?.defaultImapPort ?? 993,
    encryption: provider?.defaultEncryption ?? "tls",
    smtpHost: provider?.defaultImapHost ? provider.defaultImapHost.replace(/^imap\./i, "smtp.") : "",
    smtpPort: 465,
    smtpEncryption: "tls",
    watchedFolder: "INBOX",
    syncIntervalMinutes: 30,
    markAsRead: true,
    ignoreAlreadyRead: true,
    deleteAfterImport: false,
    attachmentFilter: "pdf-only",
  };
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white/60 p-3 transition hover:border-blue-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-300"
      />
      <span className="min-w-0 text-sm">
        <span className="block font-semibold text-slate-900">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
      </span>
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value || "—"}</dd>
    </div>
  );
}
