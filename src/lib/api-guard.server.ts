import { createClient } from "@supabase/supabase-js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const MAX_FILES = 3;
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MAX_DATA_URL_BYTES = 10 * 1024 * 1024;
const ALLOWED_MEDIA = [/^image\//, /^application\/pdf$/];

export function errorResponse(error: unknown): Response | null {
  if (error instanceof HttpError) {
    return new Response(error.message, { status: error.status });
  }
  return null;
}

export async function readJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new HttpError(413, "Požadavek je příliš velký");
  const text = await request.text();
  if (text.length > maxBytes * 2) throw new HttpError(413, "Požadavek je příliš velký");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Neplatné tělo požadavku");
  }
}

export async function requireUser(request: Request): Promise<string> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new HttpError(500, "Server není nakonfigurován");

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) throw new HttpError(401, "Nepřihlášený uživatel");

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new HttpError(401, "Nepřihlášený uživatel");
  return data.claims.sub as string;
}

export function validateDataUrl(
  url: unknown,
  mediaType: unknown,
): { url: string; mediaType: string } {
  if (typeof url !== "string" || !url.startsWith("data:")) {
    throw new HttpError(400, "Neplatná příloha");
  }
  if (typeof mediaType !== "string" || !ALLOWED_MEDIA.some((re) => re.test(mediaType))) {
    throw new HttpError(415, "Nepodporovaný typ souboru");
  }
  if (!url.startsWith(`data:${mediaType}`)) {
    throw new HttpError(400, "Příloha neodpovídá deklarovanému typu");
  }
  if (url.length > MAX_DATA_URL_BYTES * 1.4) {
    throw new HttpError(413, "Soubor je příliš velký (max. 10 MB)");
  }
  return { url, mediaType };
}
