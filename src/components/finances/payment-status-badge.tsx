import { StatusPill } from "@/components/ui/status-pill";
import { PAYMENT_STATUS_META, STATUS_META } from "@/components/finances/finance-labels";
import type { FinancialItemStatus, FinancialPaymentStatus } from "@/lib/budget/financial-item-types";

export function PaymentStatusBadge({ status }: { status: FinancialPaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return (
    <StatusPill tone={meta.tone} dot>
      {meta.label}
    </StatusPill>
  );
}

export function FinancialStatusBadge({ status }: { status: FinancialItemStatus }) {
  const meta = STATUS_META[status];
  return (
    <StatusPill tone={meta.tone} dot>
      {meta.label}
    </StatusPill>
  );
}
