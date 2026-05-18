import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

export type RequestContext = {
  requestId: string;
  route?: string;
  companyId?: string;
  userId?: string;
};

const contextStore = new AsyncLocalStorage<RequestContext>();

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLogLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[currentLogLevel()];
}

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function basePayload(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  const context = contextStore.getStore();
  return {
    ts: new Date().toISOString(),
    level,
    message,
    requestId: context?.requestId,
    route: context?.route,
    companyId: context?.companyId,
    userId: context?.userId,
    ...extra,
  };
}

function emit(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const payload = basePayload(level, message, extra);
  const line = JSON.stringify(payload);
  if (level === "error" || level === "warn") {
    console.error(line);
    return;
  }
  console.log(line);
}

export function createRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function withRequestContext<T>(context: Partial<RequestContext>, fn: () => Promise<T> | T) {
  const current = contextStore.getStore();
  const requestId = context.requestId ?? current?.requestId ?? createRequestId();
  const nextContext: RequestContext = {
    requestId,
    route: context.route ?? current?.route,
    companyId: context.companyId ?? current?.companyId,
    userId: context.userId ?? current?.userId,
  };
  try {
    return contextStore.run(nextContext, () => {
      Sentry.setTag("requestId", nextContext.requestId);
      if (nextContext.route) Sentry.setTag("route", nextContext.route);
      if (nextContext.companyId) Sentry.setTag("companyId", nextContext.companyId);
      if (nextContext.userId) Sentry.setTag("userId", nextContext.userId);
      return fn();
    });
  } catch (error) {
    throw error;
  }
}

export function getRequestContext() {
  return contextStore.getStore();
}

export async function withTiming<T>(
  op: string,
  fn: () => Promise<T> | T,
  extra?: Record<string, unknown>
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await fn();
    emit("info", "timing", {
      op,
      ms: Number((performance.now() - startedAt).toFixed(2)),
      status: "ok",
      ...extra,
    });
    return result;
  } catch (error) {
    emit("error", "timing", {
      op,
      ms: Number((performance.now() - startedAt).toFixed(2)),
      status: "error",
      error: stringifyError(error),
      ...extra,
    });
    throw error;
  }
}

export function logInfo(message: string, extra?: Record<string, unknown>) {
  emit("info", message, extra);
}

export function logError(message: string, error: unknown, extra?: Record<string, unknown>) {
  Sentry.captureException(error, {
    tags: {
      route: getRequestContext()?.route,
      requestId: getRequestContext()?.requestId,
    },
    extra,
  });
  emit("error", message, {
    error: stringifyError(error),
    ...extra,
  });
}
