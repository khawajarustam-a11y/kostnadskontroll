import { prisma } from "@/lib/prisma";

export async function deleteExpiredAccounts(now = new Date()) {
  const companies = await prisma.company.findMany({
    where: {
      deleteScheduledAt: { lte: now },
      deletedAt: null,
    },
    select: { id: true },
  });

  for (const company of companies) {
    await prisma.$transaction([
      prisma.emailConnection.deleteMany({ where: { companyId: company.id } }),
      prisma.ledgerEntry.deleteMany({ where: { companyId: company.id } }),
      prisma.contract.deleteMany({ where: { companyId: company.id } }),
      prisma.cost.deleteMany({ where: { companyId: company.id } }),
      prisma.settings.deleteMany({ where: { companyId: company.id } }),
      prisma.user.deleteMany({ where: { companyId: company.id } }),
      prisma.company.delete({ where: { id: company.id } }),
    ]);
  }

  return { deletedAccounts: companies.length };
}
