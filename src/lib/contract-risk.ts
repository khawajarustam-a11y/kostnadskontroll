import { ContractStatus } from "@prisma/client";

export type ContractRiskKind = "cancel" | "renewal" | "expiry" | "expired";
export type ContractRiskSeverity = "danger" | "warning" | "safe";

export type ContractRisk = {
  kind: ContractRiskKind;
  severity: ContractRiskSeverity;
  dueDate: Date;
  days: number;
};

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function daysUntil(date: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / msPerDay));
}

export function daysSince(date: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((now.getTime() - date.getTime()) / msPerDay));
}

export function getComputedStatus(
  endDate: Date | null,
  cancelByDate: Date | null,
  now: Date
): ContractStatus {
  const endInDays =
    endDate && endDate >= now ? daysUntil(endDate, now) : null;
  const cancelInDays =
    cancelByDate && cancelByDate >= now ? daysUntil(cancelByDate, now) : null;

  if (endDate && endDate < now) {
    return "TERMINATED";
  }
  if (
    (endInDays !== null && endInDays <= 60) ||
    (cancelInDays !== null && cancelInDays <= 30)
  ) {
    return "EXPIRING";
  }
  return "ACTIVE";
}

type ContractRiskInput = {
  endDate: Date | null;
  renewalDate: Date | null;
  cancelByDate: Date | null;
  alertDays: number | null;
};

function riskSeverity(days: number): ContractRiskSeverity {
  if (days <= 14) return "danger";
  return "warning";
}

export function getContractRisk(
  contract: ContractRiskInput,
  now: Date,
  defaultAlertDays: number
): ContractRisk | null {
  if (contract.endDate && contract.endDate < now) {
    return {
      kind: "expired",
      severity: "danger",
      dueDate: contract.endDate,
      days: daysSince(contract.endDate, now),
    };
  }

  const alertDays = contract.alertDays ?? defaultAlertDays;
  const candidates: ContractRisk[] = [];

  if (contract.cancelByDate && contract.cancelByDate >= now) {
    const days = daysUntil(contract.cancelByDate, now);
    if (days <= alertDays) {
      candidates.push({
        kind: "cancel",
        severity: riskSeverity(days),
        dueDate: contract.cancelByDate,
        days,
      });
    }
  }

  if (contract.renewalDate && contract.renewalDate >= now) {
    const days = daysUntil(contract.renewalDate, now);
    if (days <= alertDays) {
      candidates.push({
        kind: "renewal",
        severity: riskSeverity(days),
        dueDate: contract.renewalDate,
        days,
      });
    }
  }

  if (contract.endDate && contract.endDate >= now) {
    const days = daysUntil(contract.endDate, now);
    if (days <= alertDays) {
      candidates.push({
        kind: "expiry",
        severity: riskSeverity(days),
        dueDate: contract.endDate,
        days,
      });
    }
  }

  const priority: Record<ContractRiskKind, number> = {
    expired: 0,
    cancel: 1,
    renewal: 2,
    expiry: 3,
  };

  return candidates.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "danger" ? -1 : 1;
    }
    if (a.days !== b.days) return a.days - b.days;
    return priority[a.kind] - priority[b.kind];
  })[0] ?? null;
}
