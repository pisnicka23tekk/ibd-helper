import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  IBD_SYSTEM_PROMPT,
  IBD_ONBOARDING_PROMPT,
  buildContextBlock,
} from "@/lib/ibd-prompt.server";

type ChatRequestBody = {
  messages?: unknown;
  context?: unknown;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
          return new Response("Nepřihlášený uživatel", { status: 401 });
        }

        const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
        const publishableKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !publishableKey) {
          return new Response("Backend není nakonfigurován", { status: 500 });
        }

        const supabase = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
          return new Response("Neplatné přihlášení", { status: 401 });
        }

        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Chybí zprávy", { status: 400 });
        }
        const messages = body.messages as UIMessage[];

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("Chybí LOVABLE_API_KEY", { status: 500 });
        }

        const contextText =
          typeof body.context === "string" ? body.context.slice(0, 20000) : undefined;
        const isFirstTurn = messages.filter((m) => m.role === "assistant").length === 0;

        const system =
          IBD_SYSTEM_PROMPT +
          buildContextBlock(contextText) +
          (isFirstTurn ? `\n\n${IBD_ONBOARDING_PROMPT}` : "");

        try {
          const gateway = createLovableAiGatewayProvider(apiKey);
          const result = streamText({
            model: gateway("google/gemini-3.7-flash"),
            system,
            messages: await convertToModelMessages(messages),
            abortSignal: request.signal,
          });

          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (error) {
          const status =
            error != null && typeof error === "object" && "statusCode" in error
              ? Number((error as { statusCode: unknown }).statusCode)
              : 500;
          const message =
            status === 429
              ? "Příliš mnoho požadavků, zkuste to prosím za chvíli."
              : status === 402
                ? "Vyčerpaný AI kredit tohoto projektu. Doplňte kredit v nastavení Lovable."
                : "Asistent teď není dostupný. Zkuste to prosím znovu.";
          console.error("chat error", error);
          return new Response(message, { status: status >= 400 && status < 600 ? status : 500 });
        }
      },
    },
  },
});
