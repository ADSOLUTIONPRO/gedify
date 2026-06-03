import "server-only";

import type {
  MailRule,
  MailRuleAction,
  MailRuleConditionField,
} from "./types";

export type MailContext = {
  accountId: string;
  folder: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  attachmentName: string;
  attachmentExtension: string;
};

export type AppliedRule = {
  rule: MailRule;
  actions: MailRuleAction[];
};

function matchesValue(text: string | null | undefined, value: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(value.toLowerCase());
}

function evaluateCondition(
  field: MailRuleConditionField,
  value: string,
  context: MailContext,
): boolean {
  switch (field) {
    case "sender-contains":
      return matchesValue(context.from, value);
    case "subject-contains":
      return matchesValue(context.subject, value);
    case "recipient-contains":
      return matchesValue(context.to, value);
    case "attachment-name-contains":
      return matchesValue(context.attachmentName, value);
    case "attachment-extension":
      return context.attachmentExtension.toLowerCase() === value.toLowerCase().replace(/^\./, "");
    case "folder":
      return context.folder.toLowerCase() === value.toLowerCase();
    case "account":
      return context.accountId === value;
    default:
      return false;
  }
}

export function findMatchingRule(
  rules: MailRule[],
  context: MailContext,
): AppliedRule | null {
  const candidates = rules
    .filter((rule) => rule.isActive)
    .filter(
      (rule) => rule.accountIds.length === 0 || rule.accountIds.includes(context.accountId),
    )
    .sort((a, b) => a.priority - b.priority);

  for (const rule of candidates) {
    if (rule.conditions.length === 0) continue;
    const allMatch = rule.conditions.every((condition) =>
      evaluateCondition(condition.field, condition.value, context),
    );
    if (allMatch) {
      return { rule, actions: rule.actions };
    }
  }
  return null;
}

export type RuleOutcome = {
  ignore: boolean;
  tags: number[];
  documentType: number | null;
  correspondent: number | null;
  title: string | null;
  note: string | null;
  markToProcess: boolean;
};

export function buildOutcome(
  actions: MailRuleAction[] | undefined,
  defaults: {
    tags: number[];
    correspondent: number | null;
    documentType: number | null;
  },
): RuleOutcome {
  const outcome: RuleOutcome = {
    ignore: false,
    tags: [...defaults.tags],
    documentType: defaults.documentType,
    correspondent: defaults.correspondent,
    title: null,
    note: null,
    markToProcess: false,
  };

  for (const action of actions ?? []) {
    switch (action.field) {
      case "ignore":
        outcome.ignore = true;
        break;
      case "apply-tag": {
        const id = Number.parseInt(action.value, 10);
        if (!Number.isNaN(id) && !outcome.tags.includes(id)) outcome.tags.push(id);
        break;
      }
      case "set-document-type": {
        const id = Number.parseInt(action.value, 10);
        if (!Number.isNaN(id)) outcome.documentType = id;
        break;
      }
      case "set-correspondent": {
        const id = Number.parseInt(action.value, 10);
        if (!Number.isNaN(id)) outcome.correspondent = id;
        break;
      }
      case "rename-document":
        outcome.title = action.value;
        break;
      case "add-note":
        outcome.note = action.value;
        break;
      case "mark-to-process":
        outcome.markToProcess = true;
        break;
    }
  }
  return outcome;
}
