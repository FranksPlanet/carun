import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { coerceDate, coerceNumber } from "@/lib/ocr-parse";

// Accepts a base64-encoded image; sends it to Lovable AI Gateway with a vision
// model and asks for structured JSON. Returns parsed fields (review-only on the
// client — never auto-saves).
const Schema = z.object({
  image_base64: z.string().min(100).max(8_000_000),
  mime_type: z.string().default("image/jpeg"),
});

export type OcrResult = {
  date: string | null;
  total: number | null;
  liters: number | null;
  category: "fuel" | "service" | "admin" | "other" | null;
  station: string | null;
  currency: string | null;
  quantity_unit: string | null;
};

const SYSTEM = `You are an expert receipt parser. Receipts come from anywhere in the world, in any language, currency and number format.
Output STRICT JSON only, no commentary, with exactly these fields:
{"date":string|null,"total":number|null,"liters":number|null,"category":"fuel"|"service"|"admin"|"other"|null,"station":string|null,"currency":string|null,"quantity_unit":string|null}

Rules:
- "date": ALWAYS ISO "YYYY-MM-DD". You can see the receipt's language, country and currency — use those cues to resolve the local date convention yourself (e.g. US receipts are MM/DD/YYYY, most of the world is DD/MM/YYYY). If the date is genuinely ambiguous and the cues don't settle it, return null. Never guess.
- "total": the total amount paid, as a plain JSON number using "." as decimal separator, with no thousands separators, currency symbols or unit suffixes. "1 615,10", "1,615.10", "1.615,10" and "1'615.10" all mean 1615.10.
- "liters": the quantity of fuel/energy purchased, same plain-number rules. Null if not a fuel purchase.
- "quantity_unit": the unit of that quantity as written on the receipt, normalised to one of "l", "gal", "kWh", "kg". Null if there is no fuel quantity.
- "currency": ISO 4217 code (e.g. CZK, EUR, USD, GBP, CHF) inferred from the symbol, code or country context. Null if unclear.
- "category": "fuel" if a fuel/charging quantity is present or it's clearly a filling/charging station; otherwise "service", "admin" or "other".
- "station": the merchant/station name, or null.
- Any field that is missing or unreadable must be null. Never guess.`;

// Simple in-memory per-user rate limit. Stateless workers may reset this on
// cold starts, but it bounds bursty abuse within a single instance — enough
// for a friendly cap on a costly AI call.
const SCAN_LIMIT_PER_HOUR = 20;
const scanLog = new Map<string, number[]>();

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }): Promise<OcrResult> => {
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1000;
    const prior = (scanLog.get(context.userId) ?? []).filter((t) => t > windowStart);
    if (prior.length >= SCAN_LIMIT_PER_HOUR) {
      throw new Error(
        `You've scanned ${SCAN_LIMIT_PER_HOUR} receipts in the last hour. Please try again later.`,
      );
    }
    prior.push(now);
    scanLog.set(context.userId, prior);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured.");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const result = await generateText({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the JSON fields from this receipt." },
            {
              type: "image",
              image: `data:${data.mime_type};base64,${data.image_base64}`,
            } as never,
          ] as never,
        },
      ],
    });

    const text = result.text.trim();
    // Strip ```json ... ``` fences if present
    const json = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
      const parsed = JSON.parse(json);
      return {
        date: coerceDate(parsed.date),
        total: coerceNumber(parsed.total),
        liters: coerceNumber(parsed.liters),
        category: parsed.category ?? null,
        station: parsed.station ?? null,
        currency:
          typeof parsed.currency === "string" && /^[A-Za-z]{3}$/.test(parsed.currency.trim())
            ? parsed.currency.trim().toUpperCase()
            : null,
        quantity_unit:
          typeof parsed.quantity_unit === "string" && parsed.quantity_unit.trim()
            ? parsed.quantity_unit.trim()
            : null,
      };
    } catch (err) {
      // Diagnose parse failures without logging receipt contents (merchant,
      // amounts and card fragments are user financial data).
      console.error("[scanReceipt] Failed to parse model JSON", {
        error: err instanceof Error ? err.message : String(err),
        outputLength: text.length,
        outputShape: text.slice(0, 40).replace(/[^\s{}[\]":,-]/g, "x"),
      });
      return {
        date: null,
        total: null,
        liters: null,
        category: null,
        station: null,
        currency: null,
        quantity_unit: null,
      };
    }
  });
