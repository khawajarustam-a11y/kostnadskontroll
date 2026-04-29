import { Currency } from "@prisma/client";

type ExtractedContract = {
  name?: string;
  supplier?: string;
  pricePerMonth?: number;
  currency?: Currency;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  cancelByDate?: string;
  alertDays?: number;
  notes?: string;
};

function contentTypeToDataUrl(contentType: string, base64: string) {
  return `data:${contentType || "application/octet-stream"};base64,${base64}`;
}

function getOutputText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const direct = (response as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  const texts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") texts.push(text);
    }
  }
  return texts.join("\n");
}

function asCurrency(value: unknown): Currency | undefined {
  if (value === "USD" || value === "NOK" || value === "EUR") return value;
  return undefined;
}

function cleanExtraction(value: unknown): ExtractedContract | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const contract: ExtractedContract = {};
  if (typeof raw.name === "string" && raw.name.trim()) contract.name = raw.name.trim();
  if (typeof raw.supplier === "string" && raw.supplier.trim()) contract.supplier = raw.supplier.trim();
  if (typeof raw.notes === "string" && raw.notes.trim()) contract.notes = raw.notes.trim();
  if (typeof raw.pricePerMonth === "number" && raw.pricePerMonth > 0) contract.pricePerMonth = raw.pricePerMonth;
  const currency = asCurrency(raw.currency);
  if (currency) contract.currency = currency;
  for (const key of ["startDate", "endDate", "renewalDate", "cancelByDate"] as const) {
    if (typeof raw[key] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw[key])) contract[key] = raw[key];
  }
  if (typeof raw.alertDays === "number" && raw.alertDays >= 0 && raw.alertDays <= 365) contract.alertDays = raw.alertDays;
  return contract.name ? contract : null;
}

export async function extractContractFromDocument(file: File): Promise<ExtractedContract | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const contentType = file.type || "application/octet-stream";
  const dataUrl = contentTypeToDataUrl(contentType, base64);
  const isImage = contentType.startsWith("image/");
  const isText = contentType.startsWith("text/") || file.name.endsWith(".eml") || file.name.endsWith(".txt");

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: "Extract one contract/subscription from this user-provided document. Return JSON only. Use null when a field is unknown. Dates must be YYYY-MM-DD. pricePerMonth should be the recurring monthly amount when possible. currency must be USD, NOK, or EUR.",
    },
  ];

  if (isImage) {
    content.push({ type: "input_image", image_url: dataUrl, detail: "high" });
  } else if (isText) {
    content.push({ type: "input_text", text: buffer.toString("utf8").slice(0, 12000) });
  } else {
    content.push({ type: "input_file", filename: file.name || "document", file_data: dataUrl });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EXTRACTION_MODEL || "gpt-4.1-mini",
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "contract_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: ["string", "null"] },
              supplier: { type: ["string", "null"] },
              pricePerMonth: { type: ["number", "null"] },
              currency: { type: ["string", "null"], enum: ["USD", "NOK", "EUR", null] },
              startDate: { type: ["string", "null"] },
              endDate: { type: ["string", "null"] },
              renewalDate: { type: ["string", "null"] },
              cancelByDate: { type: ["string", "null"] },
              alertDays: { type: ["number", "null"] },
              notes: { type: ["string", "null"] },
            },
            required: ["name", "supplier", "pricePerMonth", "currency", "startDate", "endDate", "renewalDate", "cancelByDate", "alertDays", "notes"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Document extraction failed: ${response.status} ${await response.text()}`);
  }

  const text = getOutputText(await response.json());
  if (!text) return null;
  return cleanExtraction(JSON.parse(text));
}
