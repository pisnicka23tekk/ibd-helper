import { createFileRoute } from "@tanstack/react-router";
import { generateText, type ModelMessage } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  errorResponse,
  MAX_FILES,
  readJson,
  requireUser,
  validateDataUrl,
} from "@/lib/api-guard.server";

type IncomingFile = { name?: unknown; mediaType?: unknown; url?: unknown };
type ExtractBody = { files?: unknown };

const EXTRACT_PROMPT = `Z přiložené lékařské zprávy nebo fotografie laboratorního výsledku vytáhni všechny naměřené laboratorní hodnoty.

Odpověz POUZE čistým JSON (bez markdown bloku, bez komentáře) ve tvaru:
{"taken_on":"YYYY-MM-DD nebo null","items":[{"marker":"CRP","value":12.4,"unit":"mg/l","reference":"0-5","taken_on":"YYYY-MM-DD nebo null"}]}

Pravidla:
- "marker" použij v češtině a ve srozumitelné podobě (CRP, Fekální kalprotektin, Hemoglobin, Leukocyty, Trombocyty, Ferritin, Železo, Vitamin B12, Folát, Vitamin D, Albumin, ALT, AST, Kreatinin, Sedimentace…). Ostatní ukazatele uveď tak, jak jsou ve zprávě.
- "value" je číslo (desetinná tečka). Pokud hodnota není číselná (např. "negativní"), vynech ji z výstupu.
- "unit" opiš přesně ze zprávy, jinak null.
- "reference" je referenční rozmezí, pokud je uvedeno, jinak null.
- "taken_on" je datum odběru z dokumentu; pokud u konkrétní hodnoty není, nech null a uveď datum na horní úrovni.
- Nic si nevymýšlej. Pokud v dokumentu nejsou žádné laboratorní hodnoty, vrať {"taken_on":null,"items":[]}.`;

function parseJsonBlock(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  const year = d.getUTCFullYear();
  // No future dates (1 day tolerance for time zones) and nothing absurdly old.
  if (year < 1950 || d.getTime() > Date.now() + 86400000) return null;
  return value;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const t = value.replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
  return t ? t.slice(0, max) : null;
}

function parseValue(raw: unknown): number | null {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(raw)
        ? Number(raw.replace(",", "."))
        : NaN;
  // Lab values are finite, non-negative and within a sane magnitude.
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return Math.round(n * 10000) / 10000;
}

export const Route = createFileRoute("/api/extract-labs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireUser(request);
          const body = (await readJson(request)) as ExtractBody;
          const files = Array.isArray(body.files) ? (body.files as IncomingFile[]) : [];
          if (!files.length) return new Response("Chybí soubor", { status: 400 });
          if (files.length > MAX_FILES)
            return new Response("Příliš mnoho souborů", { status: 400 });
          const usable = files.map((f) => ({
            ...validateDataUrl(f.url, f.mediaType),
            name: cleanText(f.name, 200) ?? undefined,
          }));

          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) return new Response("Služba není nakonfigurována", { status: 500 });

          const messages: ModelMessage[] = [
            {
              role: "user",
              content: [
                { type: "text", text: EXTRACT_PROMPT },
                ...usable.map((f) => ({
                  type: "file" as const,
                  data: f.url,
                  mediaType: f.mediaType,
                  ...(f.name ? { filename: f.name } : {}),
                })),
              ],
            },
          ];

          const gateway = createLovableAiGatewayProvider(apiKey);
          const { text } = await generateText({
            model: gateway("google/gemini-3.7-flash"),
            messages,
            abortSignal: request.signal,
            maxRetries: 0,
          });

          const parsed = parseJsonBlock(text) as { taken_on?: unknown; items?: unknown } | null;
          const fallbackDate = validDate(parsed?.taken_on);
          const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
          const seen = new Set<string>();

          const items = rawItems
            .map((item) => {
              if (item == null || typeof item !== "object") return null;
              const row = item as Record<string, unknown>;
              const marker = cleanText(row["marker"], 80);
              const value = parseValue(row["value"]);
              if (!marker || value === null) return null;
              const taken_on = validDate(row["taken_on"]) ?? fallbackDate;
              const key = `${marker.toLowerCase()}|${value}|${taken_on}`;
              if (seen.has(key)) return null;
              seen.add(key);
              return {
                marker,
                value,
                unit: cleanText(row["unit"], 30),
                reference: cleanText(row["reference"], 60),
                taken_on,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
            .slice(0, 60);

          return Response.json({ taken_on: fallbackDate, items });
        } catch (error) {
          const handled = errorResponse(error);
          if (handled) return handled;
          console.error("extract-labs error", error);
          const status =
            error != null && typeof error === "object" && "statusCode" in error
              ? Number((error as { statusCode: unknown }).statusCode)
              : 500;
          const message =
            status === 429
              ? "Příliš mnoho požadavků, zkuste to prosím za chvíli."
              : status === 402
                ? "Vyčerpaný AI kredit tohoto projektu."
                : "Hodnoty se nepodařilo přečíst. Zkuste to prosím znovu.";
          return new Response(message, { status: status === 429 || status === 402 ? status : 500 });
        }
      },
    },
  },
});
