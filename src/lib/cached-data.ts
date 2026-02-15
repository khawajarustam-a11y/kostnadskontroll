import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const getSettingsByCompany = unstable_cache(
  async (companyId: string) =>
    prisma.settings.findFirst({
      where: { companyId },
      select: {
        language: true,
        displayCurrency: true,
        baseCurrency: true,
        defaultAlertDays: true,
      },
    }),
  ["settings-by-company-v1"],
  { revalidate: 60 }
);

export async function getSettingsCached(companyId: string) {
  return getSettingsByCompany(companyId);
}

