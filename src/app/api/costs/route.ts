import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyId } from "@/lib/session";
import { withRequestContext, withTiming, logError, getRequestContext } from "@/lib/observability";

export const runtime = "nodejs";

export async function GET() {
  return withRequestContext({ route: "/api/costs" }, async () => {
    try {
      const companyId = await getCompanyId();
      if (!companyId) {
        return NextResponse.json({ error: "Missing company" }, { status: 401 });
      }
      const costs = await withTiming("api.costs.list", () =>
        prisma.cost.findMany({
          where: { companyId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            supplier: true,
            category: true,
            amount: true,
            currency: true,
            frequency: true,
            createdAt: true,
          },
        })
      );

      const requestId = getRequestContext()?.requestId;
      return NextResponse.json(costs, {
        headers: requestId ? { "x-request-id": requestId } : undefined,
      });
    } catch (error) {
      logError("api.costs.failed", error);
      return NextResponse.json(
        { error: "Failed to load costs" },
        { status: 500 }
      );
    }
  });
}
