import { Contract, Settings, User } from "@prisma/client";
import { ContractRiskKind, getContractRisk } from "@/lib/contract-risk";
import { prisma } from "@/lib/prisma";

type ReminderContract = Pick<
  Contract,
  | "id"
  | "name"
  | "supplier"
  | "endDate"
  | "renewalDate"
  | "cancelByDate"
  | "alertDays"
  | "pricePerMonth"
  | "currency"
>;

type ReminderCompany = {
  id: string;
  name: string;
  timezone: string;
  settings: Pick<Settings, "defaultAlertDays"> | null;
  contracts: ReminderContract[];
  users: Pick<User, "email">[];
};

type ReminderItem = {
  contract: ReminderContract;
  kind: ContractRiskKind;
  dueDate: Date;
  days: number;
};

function formatMoney(contract: ReminderContract): string {
  if (!contract.pricePerMonth || !contract.currency) return "Unknown amount";
  return `${contract.currency} ${contract.pricePerMonth.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function localHour(timezone: string, now: Date): number | null {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(now);
    return Number(hour);
  } catch {
    return null;
  }
}

function shouldRunForCompany(timezone: string, now: Date, targetHour = 9) {
  return localHour(timezone || "UTC", now) === targetHour;
}

function riskLabel(kind: ContractRiskKind): string {
  if (kind === "cancel") return "Cancel-by deadline";
  if (kind === "renewal") return "Automatic renewal";
  if (kind === "expiry") return "Contract expires";
  return "Expired contract";
}

function appActionUrl() {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!appUrl) return null;
  const normalized = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
  return `${normalized.replace(/\/$/, "")}/action-required`;
}

function buildReminderEmail(company: ReminderCompany, items: ReminderItem[]) {
  const subject = `${items.length} contract reminder${items.length === 1 ? "" : "s"} need attention`;
  const actionUrl = appActionUrl();
  const rows = items
    .map((item) => {
      const supplier = item.contract.supplier ? ` from ${item.contract.supplier}` : "";
      const days = item.kind === "expired" ? `${item.days} days ago` : `in ${item.days} days`;
      return `<li><strong>${item.contract.name}</strong>${supplier}<br>${riskLabel(item.kind)}: ${formatDate(item.dueDate)} (${days})<br>Possible charge: ${formatMoney(item.contract)}</li>`;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2430">
      <h1 style="font-size:22px;margin-bottom:8px">Action required in ${company.name}</h1>
      <p>These contracts may renew, expire, or pass a cancellation deadline soon.</p>
      <ul>${rows}</ul>
      ${actionUrl ? `<p><a href="${actionUrl}" style="display:inline-block;background:#ff6433;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Review action items</a></p>` : ""}
      <p>Open Kostnadskontroll and review the Action Required page before the deadline.</p>
    </div>
  `;

  const text = [
    `Action required in ${company.name}`,
    "",
    ...items.map((item) => {
      const supplier = item.contract.supplier ? ` from ${item.contract.supplier}` : "";
      const days = item.kind === "expired" ? `${item.days} days ago` : `in ${item.days} days`;
      return `${item.contract.name}${supplier} - ${riskLabel(item.kind)} ${formatDate(item.dueDate)} (${days}). Possible charge: ${formatMoney(item.contract)}.`;
    }),
    "",
    actionUrl ? `Open action items: ${actionUrl}` : "Open Kostnadskontroll and review the Action Required page before the deadline.",
  ].join("\n");

  return { subject, html, text };
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) {
    return { skipped: true, reason: "Email service is not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Reminder email failed: ${response.status} ${body}`);
  }

  return { skipped: false };
}

export async function runDailyContractReminders(now = new Date(), options: { dryRun?: boolean; ignoreWindow?: boolean } = {}) {
  const companies = await prisma.company.findMany({
    include: {
      settings: { select: { defaultAlertDays: true } },
      users: { select: { email: true } },
      contracts: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          supplier: true,
          endDate: true,
          renewalDate: true,
          cancelByDate: true,
          alertDays: true,
          pricePerMonth: true,
          currency: true,
        },
      },
    },
  });

  let companiesChecked = 0;
  let reminderItems = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  let companiesSkippedForTimezone = 0;

  for (const company of companies) {
    companiesChecked += 1;
    if (!options.ignoreWindow && !shouldRunForCompany(company.timezone, now)) {
      companiesSkippedForTimezone += 1;
      continue;
    }
    const defaultAlertDays = company.settings?.defaultAlertDays ?? 30;
    const items = company.contracts
      .map((contract) => {
        const risk = getContractRisk(contract, now, defaultAlertDays);
        return risk ? { contract, kind: risk.kind, dueDate: risk.dueDate, days: risk.days } : null;
      })
      .filter((item): item is ReminderItem => item !== null)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    if (items.length === 0) continue;
    reminderItems += items.length;
    const email = buildReminderEmail(company, items);

    for (const user of company.users) {
      if (options.dryRun) {
        emailsSkipped += 1;
        continue;
      }
      const result = await sendEmail(user.email, email.subject, email.html, email.text);
      if (result.skipped) emailsSkipped += 1;
      else emailsSent += 1;
    }
  }

  return {
    companiesChecked,
    reminderItems,
    emailsSent,
    emailsSkipped,
    companiesSkippedForTimezone,
    configured: Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL),
    dryRun: Boolean(options.dryRun),
    timezoneAware: true,
  };
}
