import "dotenv/config";
import { PrismaClient, Currency, ContractStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  ),
});

async function main() {
  await prisma.contract.deleteMany();
  await prisma.cost.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.company.deleteMany();

  const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@duekeeper.com";
  const demoPassword = process.env.DEMO_USER_PASSWORD ?? "Demo1234";
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const company = await prisma.company.create({
    data: {
      id: "demo-company",
      name: "Demo AS",
      settings: {
        create: {
          displayCurrency: Currency.NOK,
          baseCurrency: Currency.USD,
          defaultAlertDays: 30,
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: demoEmail,
      passwordHash,
      companyId: company.id,
    },
  });

  await prisma.cost.createMany({
    data: [
      {
        companyId: company.id,
        name: "Google Workspace",
        supplier: "Google",
        category: "System Software",
        amount: 18,
        currency: Currency.USD,
        amountUsd: 18,
        frequency: "MONTHLY",
        isActive: true,
      },
      {
        companyId: company.id,
        name: "Microsoft 365",
        supplier: "Microsoft",
        category: "System Software",
        amount: 12,
        currency: Currency.USD,
        amountUsd: 12,
        frequency: "MONTHLY",
        isActive: true,
      },
      {
        companyId: company.id,
        name: "Telia Mobil",
        supplier: "Telia",
        category: "Telecom",
        amount: 399,
        currency: Currency.NOK,
        amountUsd: 40,
        frequency: "MONTHLY",
        isActive: true,
      },
      {
        companyId: company.id,
        name: "AWS",
        supplier: "Amazon",
        category: "Hosting",
        amount: 65,
        currency: Currency.USD,
        amountUsd: 65,
        frequency: "MONTHLY",
        isActive: true,
      },
      {
        companyId: company.id,
        name: "Regnskap",
        supplier: "Tripletex",
        category: "Finance",
        amount: 1199,
        currency: Currency.NOK,
        amountUsd: 120,
        frequency: "MONTHLY",
        isActive: true,
      },
    ],
  });

  await prisma.contract.createMany({
    data: [
      {
        companyId: company.id,
        name: "Internett-abonnement",
        supplier: "Telenor",
        status: ContractStatus.ACTIVE,
        startDate: new Date("2023-06-01"),
        endDate: new Date("2025-06-01"),
      },
      {
        companyId: company.id,
        name: "CRM-avtale",
        supplier: "HubSpot",
        status: ContractStatus.EXPIRING,
        startDate: new Date("2024-02-01"),
        endDate: new Date("2024-12-01"),
      },
      {
        companyId: company.id,
        name: "Kontorleie",
        supplier: "Oslo Eiendom",
        status: ContractStatus.ACTIVE,
        startDate: new Date("2022-01-01"),
        endDate: new Date("2026-01-01"),
      },
      {
        companyId: company.id,
        name: "Designavtale",
        supplier: "Fjord Studio",
        status: ContractStatus.EXPIRING,
        startDate: new Date("2024-03-15"),
        endDate: new Date("2024-10-15"),
      },
      {
        companyId: company.id,
        name: "Forsikring",
        supplier: "Tryg",
        status: ContractStatus.ACTIVE,
        startDate: new Date("2023-01-01"),
        endDate: new Date("2025-01-01"),
      },
    ],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

