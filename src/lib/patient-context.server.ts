import { createClient } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type DailyLog = Tables<"daily_logs">;
type LabResult = Tables<"lab_results">;
type HealthProfile = Tables<"health_profile">;

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === false) {
    return null;
  }

  return `${label}: ${value === true ? "ano" : value}`;
}

function formatDailyLog(log: DailyLog): string {
  const parts = [
    line("bolest (0-10)", log.pain_level),
    line("lokalizace bolesti", log.pain_location),
    line("stolice/den", log.stool_count),
    line("konzistence (Bristol 1-7)", log.stool_consistency),
    line("krev", log.blood),
    line("hlen", log.mucus),
    line("urgence", log.urgency),
    line("nadýmání", log.bloating),
    line("nevolnost", log.nausea),
    line("chuť k jídlu", log.appetite),
    line("hmotnost kg", log.weight_kg),
    line("teplota °C", log.temperature_c),
    line("únava", log.fatigue),
    line("spánek h", log.sleep_hours),
    line("kvalita spánku", log.sleep_quality),
    line("stres", log.stress),
    line("nálada", log.mood),
    line("pohyb min", log.activity_minutes),
    line("tekutiny l", log.hydration_liters),
    line("alkohol", log.alcohol),
    line("kouření", log.smoking),
    line("jídlo", log.foods),
    line("léky", log.medications),
    line("poznámka", log.notes),
  ].filter(Boolean);

  return `- ${log.log_date}: ${parts.join("; ") || "bez údajů"}`;
}

export async function buildPatientContext(userId: string): Promise<string> {
  const url = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !serviceRoleKey) {
    throw new Error("Server nemá nakonfigurovaný Supabase service role klíč");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const [profileRes, logsRes, labsRes] = await Promise.all([
    supabase
      .from("health_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),

    supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(60),

    supabase
      .from("lab_results")
      .select("*")
      .eq("user_id", userId)
      .order("taken_on", { ascending: false })
      .limit(80),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (logsRes.error) throw logsRes.error;
  if (labsRes.error) throw labsRes.error;

  const sections: string[] = [];

  const profile = profileRes.data as HealthProfile | null;

  if (profile) {
    const rows = [
      line("diagnóza", profile.diagnosis),
      line("rok diagnózy", profile.diagnosis_year),
      line("lokalizace nemoci", profile.disease_location),
      line("současná léčba", profile.current_treatment),
      line("předchozí léčba", profile.past_treatment),
      line("operace", profile.surgeries),
      line("další nemoci", profile.other_conditions),
      line("alergie", profile.allergies),
      line("doplňky stravy", profile.supplements),
      line("kouření", profile.smoking),
      line("poznámky", profile.notes),
    ].filter(Boolean);

    if (rows.length) {
      sections.push(`ZDRAVOTNÍ PROFIL\n${rows.join("\n")}`);
    }
  }

  const logs = (logsRes.data ?? []) as DailyLog[];

  if (logs.length) {
    sections.push(
      `DENÍK (posledních ${logs.length} záznamů, od nejnovějšího)\n${logs
        .map(formatDailyLog)
        .join("\n")}`,
    );
  }

  const labs = (labsRes.data ?? []) as LabResult[];

  if (labs.length) {
    sections.push(
      `LABORATORNÍ VÝSLEDKY\n${labs
        .map(
          (lab) =>
            `- ${lab.taken_on} ${lab.marker}: ${lab.value ?? "?"} ${
              lab.unit ?? ""
            }${lab.note ? ` (${lab.note})` : ""}`,
        )
        .join("\n")}`,
    );
  }

  return sections.join("\n\n");
}
