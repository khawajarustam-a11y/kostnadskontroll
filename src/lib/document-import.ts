import { Currency, LedgerEntryType } from "@prisma/client";

export type DocumentImportType = "contracts" | "costs" | "ledger";

export type ExtractedDocumentImport = {
  name?: string;
  supplier?: string;
  category?: string;
  description?: string;
  amount?: number;
  pricePerMonth?: number;
  currency?: Currency;
  frequency?: string;
  type?: LedgerEntryType;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  cancelByDate?: string;
  entryDate?: string;
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

function asLedgerType(value: unknown): LedgerEntryType | undefined {
  if (value === "INCOME" || value === "EXPENSE") return value;
  return undefined;
}

function cleanExtraction(value: unknown, importType: DocumentImportType): ExtractedDocumentImport | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const item: ExtractedDocumentImport = {};

  for (const key of ["name", "supplier", "category", "description", "frequency", "notes"] as const) {
    if (typeof raw[key] === "string" && raw[key].trim()) item[key] = raw[key].trim();
  }

  for (const key of ["amount", "pricePerMonth"] as const) {
    if (typeof raw[key] === "number" && raw[key] > 0) item[key] = raw[key];
  }

  const currency = asCurrency(raw.currency);
  if (currency) item.currency = currency;
  const ledgerType = asLedgerType(raw.type);
  if (ledgerType) item.type = ledgerType;

  for (const key of ["startDate", "endDate", "renewalDate", "cancelByDate", "entryDate"] as const) {
    if (typeof raw[key] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw[key])) item[key] = raw[key];
  }

  if (typeof raw.alertDays === "number" && raw.alertDays >= 0 && raw.alertDays <= 365) item.alertDays = raw.alertDays;

  if (importType === "contracts" && !item.name) return null;
  if (importType === "costs" && (!item.name || !item.amount)) return null;
  if (importType === "ledger" && (!item.amount || !item.entryDate)) return null;
  return item;
}

function instructionFor(importType: DocumentImportType) {
  if (importType === "contracts") {
    return "Extract one contract or subscription. Required if visible: name, supplier, recurring monthly price, currency, start/end/renewal/cancel-by dates, alert days, notes.";
  }
  if (importType === "costs") {
    return "Extract one recurring cost. Required if visible: name, supplier, category, amount, currency, frequency, start date, notes. amount is the recurring amount for the selected frequency.";
  }
  return "Extract one accounting ledger entry. Required if visible: type INCOME or EXPENSE, amount, currency, category, description, entry date.";
}

export async function extractFromDocument(file: File, importType: DocumentImportType): Promise<ExtractedDocumentImport | null> {
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
      text: `${instructionFor(importType)} Return JSON only. Use null when a field is unknown. Dates must be YYYY-MM-DD. currency must be USD, NOK, or EUR.`,
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
          name: "document_import_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: ["string", "null"] },
              supplier: { type: ["string", "null"] },
              category: { type: ["string", "null"] },
              description: { type: ["string", "null"] },
              amount: { type: ["number", "null"] },
              pricePerMonth: { type: ["number", "null"] },
              currency: { type: ["string", "null"], enum: ["USD", "NOK", "EUR", null] },
              frequency: { type: ["string", "null"] },
              type: { type: ["string", "null"], enum: ["INCOME", "EXPENSE", null] },
              startDate: { type: ["string", "null"] },
              endDate: { type: ["string", "null"] },
              renewalDate: { type: ["string", "null"] },
              cancelByDate: { type: ["string", "null"] },
              entryDate: { type: ["string", "null"] },
              alertDays: { type: ["number", "null"] },
              notes: { type: ["string", "null"] },
            },
            required: ["name", "supplier", "category", "description", "amount", "pricePerMonth", "currency", "frequency", "type", "startDate", "endDate", "renewalDate", "cancelByDate", "entryDate", "alertDays", "notes"],
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
  return cleanExtraction(JSON.parse(text), importType);
}
