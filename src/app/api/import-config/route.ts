import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const openAiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const model = process.env.OPENAI_EXTRACTION_MODEL?.trim() ?? "";

  return NextResponse.json({
    openAiConfigured: openAiKey.startsWith("sk-"),
    openAiKeyPresent: openAiKey.length > 0,
    openAiKeyLength: openAiKey.length,
    model: model || "gpt-4.1-mini",
    nodeEnv: process.env.NODE_ENV,
  });
}
