import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getRequestContext, logError, logInfo } from "@/lib/observability";

function createClient() {
  const base = new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: process.env.DATABASE_URL,
      })
    ),
    log: ["error"],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const startedAt = performance.now();
          try {
            const result = await query(args);
            const context = getRequestContext();
            logInfo("db.query", {
              model,
              action: operation,
              ms: Number((performance.now() - startedAt).toFixed(2)),
              requestId: context?.requestId,
              route: context?.route,
            });
            return result;
          } catch (error) {
            const context = getRequestContext();
            logError("db.query.failed", error, {
              model,
              action: operation,
              ms: Number((performance.now() - startedAt).toFixed(2)),
              requestId: context?.requestId,
              route: context?.route,
            });
            throw error;
          }
        },
      },
    },
  });
}

type PrismaExtendedClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaExtendedClient;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

