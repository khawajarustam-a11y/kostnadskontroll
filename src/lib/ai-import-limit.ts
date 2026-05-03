import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_PREFIX = "rg_ai_imports";
const DEFAULT_DAILY_LIMIT = 1;

type StoredUsage = {
  day: string;
  used: number;
};

export type AiImportUsage = {
  day: string;
  limit: number;
  used: number;
  remaining: number;
  isLimited: boolean;
};

function getDailyLimit() {
  const parsed = Number(process.env.FREE_AI_IMPORT_DAILY_LIMIT);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return DEFAULT_DAILY_LIMIT;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getCookieName(companyId: string) {
  const hash = createHash("sha256").update(companyId).digest("hex").slice(0, 16);
  return `${COOKIE_PREFIX}_${hash}`;
}

function readStoredUsage(value: string | undefined, day: string): StoredUsage {
  if (!value) {
    return { day, used: 0 };
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredUsage>;
    if (parsed.day === day && typeof parsed.used === "number" && Number.isFinite(parsed.used)) {
      return { day, used: Math.max(0, Math.floor(parsed.used)) };
    }
  } catch {
    return { day, used: 0 };
  }

  return { day, used: 0 };
}

function toUsage(stored: StoredUsage, limit: number): AiImportUsage {
  const used = Math.min(stored.used, limit);
  const remaining = Math.max(0, limit - used);
  return {
    day: stored.day,
    limit,
    used,
    remaining,
    isLimited: remaining <= 0,
  };
}

export async function getAiImportUsage(companyId: string): Promise<AiImportUsage> {
  const day = getTodayKey();
  const limit = getDailyLimit();
  const cookieStore = await cookies();
  const stored = readStoredUsage(cookieStore.get(getCookieName(companyId))?.value, day);
  return toUsage(stored, limit);
}

export async function consumeAiImportAllowance(companyId: string): Promise<AiImportUsage & { allowed: boolean }> {
  const current = await getAiImportUsage(companyId);
  if (current.isLimited) {
    return { ...current, allowed: false };
  }

  const next = toUsage({ day: current.day, used: current.used + 1 }, current.limit);
  const cookieStore = await cookies();
  cookieStore.set(getCookieName(companyId), JSON.stringify({ day: next.day, used: next.used }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 36,
  });

  return { ...next, allowed: true };
}
