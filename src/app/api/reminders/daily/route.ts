import { NextRequest, NextResponse } from "next/server";
import { runDailyContractReminders } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const ignoreWindow = request.nextUrl.searchParams.get("ignoreWindow") === "1";
  const result = await runDailyContractReminders(new Date(), { dryRun, ignoreWindow });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return GET(request);
}
