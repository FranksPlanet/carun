import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";

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
};

const SYSTEM = `You are an expert receipt parser for Czech fuel and service receipts.
Extract only these fields and output STRICT JSON with no commentary:
{"date":"YYYY-MM-DD or null","total":number or null (total amount in CZK as a plain number),"liters":number or null,"category":"fuel"|"service"|"admin"|"other"|null,"station":string or null}
- "category" should be "fuel" if liters are present or it's clearly a gas station.
- Comma is the decimal separator on Czech receipts; convert to dot.
- If a field is missing or unreadable, use null. Do not guess.`;

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
        date: parsed.date ?? null,
        total: typeof parsed.total === "number" ? parsed.total : null,
        liters: typeof parsed.liters === "number" ? parsed.liters : null,
        category: parsed.category ?? null,
        station: parsed.station ?? null,
      };
    } catch {
      return { date: null, total: null, liters: null, category: null, station: null };
    }
  });
