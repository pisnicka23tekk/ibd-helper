import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText, type ModelMessage } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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

export const Route = createFileRoute("/api/extract-labs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "")
          .replace(/^Bearer\s+/i, "")
          .trim();
        if (!token) return new Response("Nepřihlášený uživatel", { status: 401 });

        const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
        const publishableKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !publishableKey) {
          return new Response("Backend není nakonfigurován", { status: 500 });
        }
        const supabase = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
          return new Response("Neplatné přihlášení", { status: 401 });
        }

        const body = (await request.json()) as ExtractBody;
        const files = Array.isArray(body.files) ? (body.files as IncomingFile[]) : [];
        const usable = files.filter(
          (f) => typeof f.url === "string" && typeof f.mediaType === "string",
        );
        if (!usable.length) return new Response("Chybí soubor", { status: 400 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Chybí LOVABLE_API_KEY", { status: 500 });

        const messages: ModelMessage[] = [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACT_PROMPT },
              ...usable.map((f) => ({
                type: "file" as const,
                data: new URL(f.url as string),
                mediaType: f.mediaType as string,
                filename: typeof f.name === "string" ? f.name : undefined,
              })),
            ],
          },
        ];

        try {
          const gateway = createLovableAiGatewayProvider(apiKey);
          const { text } = await generateText({
            model: gateway("google/gemini-3.7-flash"),
            messages,
            abortSignal: request.signal,
          });

          const parsed = parseJsonBlock(text) as
            | { taken_on?: unknown; items?: unknown }
            | null;
          const fallbackDate =
            typeof parsed?.taken_on === "string" && ISO_DATE.test(parsed.taken_on)
              ? parsed.taken_on
              : null;
          const rawItems = Array.isArray(parsed?.items) ? parsed!.items : [];

          const items = rawItems
            .map((item) => {
              const row = item as Record<string, unknown>;
              const marker = typeof row["marker"] === "string" ? row["marker"].trim() : "";
              const value =
                typeof row["value"] === "number"
                  ? row["value"]
                  : typeof row["value"] === "string" && row["value"].trim() !== ""
                    ? Number(String(row["value"]).replace(",", "."))
                    : null;
              if (!marker || value === null || Number.isNaN(value)) return null;
              const itemDate =
                typeof row["taken_on"] === "string" && ISO_DATE.test(row["taken_on"])
                  ? row["taken_on"]
                  : fallbackDate;
              return {
                marker,
                value,
                unit: typeof row["unit"] === "string" && row["unit"].trim() ? row["unit"].trim() : null,
                reference:
                  typeof row["reference"] === "string" && row["reference"].trim()
                    ? row["reference"].trim()
                    : null,
                taken_on: itemDate,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
            .slice(0, 60);

          return Response.json({ taken_on: fallbackDate, items });
        } catch (error) {
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
          return new Response(message, { status: status >= 400 && status < 600 ? status : 500 });
        }
      },
    },
  },
});
