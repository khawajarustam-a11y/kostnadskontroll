import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { getTranslations } from "@/lib/i18n";
import { withRequestContext, withTiming, logError, getRequestContext } from "@/lib/observability";

export const runtime = "nodejs";

function escapeCsv(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  return withRequestContext({ route: "/api/ledger/export" }, async () => {
    try {
      const companyId = await requireCompanyId();
      const settings = await withTiming("api.ledger_export.settings", () =>
        prisma.settings.findFirst({ where: { companyId } })
      );
      const { t, language } = getTranslations(settings?.language);
      const locale = language === "NO" ? "nb-NO" : "en-US";

      const entries = await withTiming("api.ledger_export.entries", () =>
        prisma.ledgerEntry.findMany({
          where: { companyId, deletedAt: null },
          orderBy: { entryDate: "desc" },
          select: {
            entryDate: true,
            type: true,
            category: true,
            description: true,
            amount: true,
            currency: true,
          },
        })
      );

      const header = [
        t("entryDate"),
        t("entryType"),
        t("category"),
        t("description"),
        t("amount"),
        t("currency"),
      ];

      const rows = entries.map((entry) => [
        new Intl.DateTimeFormat(locale).format(entry.entryDate),
        entry.type,
        entry.category ?? "",
        entry.description ?? "",
        String(entry.amount),
        entry.currency,
      ]);

      const csv = [header, ...rows]
        .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
        .join("\n");

      const requestId = getRequestContext()?.requestId;
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=ledger.csv",
          ...(requestId ? { "x-request-id": requestId } : {}),
        },
      });
    } catch (error) {
      logError("api.ledger_export.failed", error);
      return new Response("Failed to export ledger", { status: 500 });
    }
  });
}
