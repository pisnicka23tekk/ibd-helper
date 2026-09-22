import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ReportRequestBody = {
  context?: unknown;
  days?: unknown;
};

const REPORT_PROMPT = `Jsi klinický asistent, který pro pacienta s IBD (Crohnova choroba / ulcerózní kolitida) připravuje stručný, věcný souhrn pro gastroenterologa před kontrolou.

Piš česky, v odborném, ale čitelném tónu, ve formátu Markdown. Struktura:

## Souhrn pro gastroenterologa
Krátký odstavec (3–5 vět): jak pacient objektivně vypadá za sledované období.

## Základní údaje
Diagnóza, rok, lokalizace, operace, současná léčba (odrážky).

## Vývoj symptomů za sledované období
Konkrétní čísla a trendy: bolest (průměr/rozsah), počet stolic, krev ve stolici (kolik dní z kolika), urgence, hmotnost (změna v kg), teploty, únava, spánek, stres. Uveď jen to, co je v datech.

## Laboratorní hodnoty
Tabulka Markdown: ukazatel | poslední hodnota (datum) | předchozí | trend.

## Mimostřevní a další projevy
Pokud jsou v datech.

## Otázky a body k probrání s lékařem
5–8 konkrétních odrážek podložených daty (např. návrh kontroly kalprotektinu, hladiny biologika, doplnění železa, zvážení vyšetření).

## Chybějící údaje
Co by bylo dobré doplnit, aby byl obraz úplnější.

Pravidla:
- Vycházej POUZE z dodaných dat. Nic si nevymýšlej, neuváděj hodnoty, které nemáš.
- Neurčuj diagnózu a nepředepisuj léčbu; formuluj jako podněty k diskusi s lékařem.
- Žádný úvodní ani závěrečný chat ("Zde je…"), začni přímo nadpisem.
- Buď kompaktní — souhrn se má vejít na 1–2 stránky A4.`;

export const Route = createFileRoute("/api/report")({
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

        const body = (await request.json()) as ReportRequestBody;
        const context = typeof body.context === "string" ? body.context.slice(0, 30000) : "";
        if (!context.trim()) {
          return new Response("Chybí data pro souhrn", { status: 400 });
        }
        const days = typeof body.days === "number" && body.days > 0 ? Math.round(body.days) : 90;

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Chybí LOVABLE_API_KEY", { status: 500 });

        try {
          const gateway = createLovableAiGatewayProvider(apiKey);
          const result = streamText({
            model: gateway("google/gemini-3.7-flash"),
            system: REPORT_PROMPT,
            prompt: `Sledované období: posledních ${days} dní. Dnešní datum: ${new Date().toISOString().slice(0, 10)}.\n\nDATA PACIENTA:\n${context}`,
            abortSignal: request.signal,
          });
          return result.toTextStreamResponse();
        } catch (error) {
          console.error("report error", error);
          const status =
            error != null && typeof error === "object" && "statusCode" in error
              ? Number((error as { statusCode: unknown }).statusCode)
              : 500;
          const message =
            status === 429
              ? "Příliš mnoho požadavků, zkuste to prosím za chvíli."
              : status === 402
                ? "Vyčerpaný AI kredit tohoto projektu."
                : "Souhrn se teď nepodařilo vytvořit. Zkuste to prosím znovu.";
          return new Response(message, { status: status >= 400 && status < 600 ? status : 500 });
        }
      },
    },
  },
});
