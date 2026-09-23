import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { errorResponse, HttpError, MAX_FILES, readJson, requireUser, validateDataUrl } from "@/lib/api-guard.server";
import {
  IBD_SYSTEM_PROMPT,
  IBD_ONBOARDING_PROMPT,
  buildContextBlock,
} from "@/lib/ibd-prompt.server";

const MAX_MESSAGES = 200;
const MAX_TEXT = 20000;

function sanitizeMessages(raw: unknown): UIMessage[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    throw new HttpError(400, "Neplatné zprávy");
  }
  let fileCount = 0;
  return raw.map((m, i) => {
    const msg = m as Partial<UIMessage>;
    if (msg.role !== "user" && msg.role !== "assistant") throw new HttpError(400, "Neplatná role zprávy");
    if (!Array.isArray(msg.parts)) throw new HttpError(400, "Neplatné zprávy");
    const parts = msg.parts.flatMap((p) => {
      const part = p as { type?: unknown; text?: unknown; url?: unknown; mediaType?: unknown; filename?: unknown };
      if (part.type === "text" && typeof part.text === "string") {
        return [{ type: "text" as const, text: part.text.slice(0, MAX_TEXT) }];
      }
      if (part.type === "file" && msg.role === "user") {
        // Only the latest message carries fresh files; older ones are re-sent from client state.
        if (++fileCount > MAX_FILES * 4) throw new HttpError(400, "Příliš mnoho příloh");
        const file = validateDataUrl(part.url, part.mediaType);
        return [{
          type: "file" as const,
          url: file.url,
          mediaType: file.mediaType,
          filename: typeof part.filename === "string" ? part.filename.slice(0, 200) : undefined,
        }];
      }
      return []; // drop reasoning/tool/unknown parts
    });
    return { id: typeof msg.id === "string" ? msg.id.slice(0, 100) : `m${i}`, role: msg.role, parts } as UIMessage;
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireUser(request);
          const body = (await readJson(request)) as { messages?: unknown; context?: unknown };
          const messages = sanitizeMessages(body.messages);

          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) return new Response("Asistent není nakonfigurován", { status: 500 });

          const contextText = typeof body.context === "string" ? body.context.slice(0, 20000) : undefined;
          const isFirstTurn = messages.filter((m) => m.role === "assistant").length === 0;
          const system =
            IBD_SYSTEM_PROMPT +
            buildContextBlock(contextText) +
            (isFirstTurn ? `\n\n${IBD_ONBOARDING_PROMPT}` : "");

          const gateway = createLovableAiGatewayProvider(apiKey);
          const result = streamText({
            model: gateway("google/gemini-3.7-flash"),
            system,
            messages: await convertToModelMessages(messages),
            abortSignal: request.signal,
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onError: (error) => {
              console.error("chat stream error", error);
              const status =
                error != null && typeof error === "object" && "statusCode" in error
                  ? Number((error as { statusCode: unknown }).statusCode)
                  : 0;
              if (status === 429) return "Příliš mnoho požadavků, zkuste to prosím za chvíli.";
              if (status === 402) return "Vyčerpaný AI kredit tohoto projektu.";
              return "Asistent teď není dostupný. Zkuste to prosím znovu.";
            },
          });
        } catch (error) {
          const handled = errorResponse(error);
          if (handled) return handled;
          console.error("chat error", error);
          return new Response("Asistent teď není dostupný. Zkuste to prosím znovu.", { status: 500 });
        }
      },
    },
  },
});
