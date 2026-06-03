import { AlertTriangle, Info, ShieldAlert, Sparkles } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type {
  AIAnalysisWarning,
  AIOriginalSuggestion,
  AIRuleMatch,
} from "@/lib/ai/types";

type AIWarningsPanelProps = {
  warnings?: AIAnalysisWarning[] | null;
  autoApplyEligible?: boolean | null;
  blockedReason?: string | null;
  ruleMatches?: AIRuleMatch[] | null;
  originalSuggestion?: AIOriginalSuggestion | null;
  currentCorrespondent?: string | null;
  compact?: boolean;
};

export function AIWarningsPanel({
  warnings,
  autoApplyEligible,
  blockedReason,
  ruleMatches,
  originalSuggestion,
  currentCorrespondent,
  compact,
}: AIWarningsPanelProps) {
  const hasWarnings = Array.isArray(warnings) && warnings.length > 0;
  const hasRules = Array.isArray(ruleMatches) && ruleMatches.length > 0;
  const wasOverridden =
    originalSuggestion &&
    originalSuggestion.correspondentName !== null &&
    originalSuggestion.correspondentName !== currentCorrespondent;
  const blocked = autoApplyEligible === false || hasWarnings;

  if (!hasWarnings && !hasRules && !wasOverridden && autoApplyEligible !== false) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl ${compact ? "p-3" : "p-4"} space-y-3`}
      style={{
        border: `1px solid ${blocked ? "rgba(245,158,11,0.30)" : "rgba(11,92,255,0.18)"}`,
        background: blocked ? "rgba(245,158,11,0.06)" : "rgba(11,92,255,0.04)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: blocked ? "rgba(245,158,11,0.18)" : "rgba(11,92,255,0.12)",
            color: blocked ? "#B45309" : "var(--blue-600)",
          }}
        >
          {blocked ? (
            <ShieldAlert className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-extrabold"
            style={{ color: "var(--text-main)" }}
          >
            {blocked ? "Validation manuelle requise" : "Contrôles de cohérence"}
          </p>
          <p
            className="mt-0.5 text-xs leading-snug"
            style={{ color: "var(--text-muted)" }}
          >
            {blocked
              ? blockedReason ??
                "Des règles métier ont signalé des incohérences. Application automatique désactivée."
              : "Les règles de cohérence ont validé la proposition IA."}
          </p>
        </div>
        <StatusPill tone={blocked ? "amber" : "emerald"} dot>
          {blocked ? "Auto-apply OFF" : "Auto-apply OK"}
        </StatusPill>
      </div>

      {wasOverridden ? (
        <div
          className="rounded-xl px-3 py-2 text-xs"
          style={{
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.18)",
            color: "var(--text-main)",
          }}
        >
          <p className="font-bold" style={{ color: "#7C3AED" }}>
            Correspondant corrigé par les règles
          </p>
          <p className="mt-0.5" style={{ color: "var(--text-muted)" }}>
            IA proposait :{" "}
            <span className="font-semibold" style={{ color: "var(--text-main)" }}>
              {originalSuggestion?.correspondentName ?? "—"}
            </span>
            <span className="mx-1">→</span>
            règle :{" "}
            <span className="font-semibold" style={{ color: "var(--text-main)" }}>
              {currentCorrespondent ?? "À déterminer"}
            </span>
          </p>
        </div>
      ) : null}

      {hasWarnings ? (
        <ul className="space-y-1.5">
          {warnings!.map((w, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-xs"
              style={{ color: "var(--text-main)" }}
            >
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: "#B45309" }}
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>
                <span
                  className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold mr-1.5"
                  style={{
                    background: "rgba(245,158,11,0.18)",
                    color: "#92400E",
                  }}
                >
                  {w.code}
                </span>
                {w.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {hasRules && !compact ? (
        <details className="text-xs">
          <summary
            className="cursor-pointer font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            Règles déterministes déclenchées ({ruleMatches!.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {ruleMatches!.map((m) => (
              <li
                key={m.ruleId}
                className="flex items-start gap-2"
                style={{ color: "var(--text-muted)" }}
              >
                <Info
                  className="mt-0.5 h-3 w-3 shrink-0"
                  style={{ color: "var(--blue-600)" }}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>
                  <span
                    className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold mr-1.5"
                    style={{
                      background:
                        m.weight === "strong"
                          ? "rgba(11,92,255,0.12)"
                          : "rgba(100,116,139,0.12)",
                      color:
                        m.weight === "strong" ? "var(--blue-600)" : "#475569",
                    }}
                  >
                    {m.ruleId}
                  </span>
                  {m.description}
                  {m.markersMatched.length > 0 ? (
                    <span
                      className="ml-1.5 italic"
                      style={{ color: "var(--text-muted)" }}
                    >
                      (marqueurs : {m.markersMatched.slice(0, 3).join(", ")})
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
