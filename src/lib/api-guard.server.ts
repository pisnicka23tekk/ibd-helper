import { createClient } from "@supabase/supabase-js";

/** Max request body for AI endpoints (base64 attachments included). */
export const MAX_BODY_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;
const ALLOWED_MEDIA = /^(image\/(png|jpe?g|webp|gif|heic|heif)|application\/pdf)$/i;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response | null {
  if (error instanceof HttpError) return new Response(error.message, { status: error.status });
  return null;
}

/** Verifies the bearer token and returns the user id. */
export async function requireUser(request: Request): Promise<string> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.split(".").length !== 3) throw new HttpError(401, "Nepřihlášený uživatel");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new HttpError(500, "Backend není nakonfigurován");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Neplatné přihlášení");
  return data.user.id;
}

/** Reads a JSON body with a hard size cap. */
export async function readJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "Požadavek je příliš velký");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Požadavek je příliš velký");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Neplatný formát požadavku");
  }
}

/**
 * Accepts only inline base64 data URLs of allowed types and size.
 * Remote URLs are rejected so the server never fetches attacker-chosen addresses.
 */
export function validateDataUrl(
  url: unknown,
  mediaType: unknown,
): { url: string; mediaType: string } {
  if (typeof url !== "string" || typeof mediaType !== "string")
    throw new HttpError(400, "Neplatná příloha");
  const m = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(url);
  if (!m) throw new HttpError(400, "Příloha musí být nahraný soubor");
  const type = m[1]!.toLowerCase();
  if (!ALLOWED_MEDIA.test(type) || type !== mediaType.toLowerCase()) {
    throw new HttpError(415, "Nepodporovaný typ souboru (jen obrázky a PDF)");
  }
  if (Math.floor((m[2]!.length * 3) / 4) > MAX_FILE_BYTES)
    throw new HttpError(413, "Soubor je větší než 10 MB");
  return { url, mediaType: type };
}
