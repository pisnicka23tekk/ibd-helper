import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type DailyLog = Tables<"daily_logs">;
export type LabResult = Tables<"lab_results">;
export type HealthProfile = Tables<"health_profile">;

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === false) return null;
  return `${label}: ${value === true ? "ano" : value}`;
}

export function formatDailyLog(log: DailyLog): string {
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

export async function buildHealthContext(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return "";
  const [profileRes, logsRes, labsRes] = await Promise.all([
    supabase.from("health_profile").select("*").eq("user_id", userId).maybeSingle(),
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

  const sections: string[] = [];
  const profile = profileRes.data;
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
    if (rows.length) sections.push(`ZDRAVOTNÍ PROFIL\n${rows.join("\n")}`);
  }

  const logs = logsRes.data ?? [];
  if (logs.length) {
    sections.push(
      `DENÍK (posledních ${logs.length} záznamů, od nejnovějšího)\n${logs.map(formatDailyLog).join("\n")}`,
    );
  }

  const labs = labsRes.data ?? [];
  if (labs.length) {
    sections.push(
      `LABORATORNÍ VÝSLEDKY\n${labs
        .map(
          (l) =>
            `- ${l.taken_on} ${l.marker}: ${l.value ?? "?"} ${l.unit ?? ""}${l.note ? ` (${l.note})` : ""}`,
        )
        .join("\n")}`,
    );
  }

  return sections.join("\n\n");
}
