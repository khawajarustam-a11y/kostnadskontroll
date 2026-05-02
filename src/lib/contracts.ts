import { ContractStatus } from "@prisma/client";

function daysUntil(date: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / msPerDay));
}

export function getComputedContractStatus(
  endDate: Date | null,
  cancelByDate: Date | null,
  now: Date
): ContractStatus {
  const endInDays = endDate && endDate >= now ? daysUntil(endDate, now) : null;
  const cancelInDays = cancelByDate && cancelByDate >= now ? daysUntil(cancelByDate, now) : null;

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
