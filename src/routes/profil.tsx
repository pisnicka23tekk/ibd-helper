import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { AppShell, RequireAuth } from "@/components/AppShell";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Zdravotní profil — IBD Kompas" },
      {
        name: "description",
        content:
          "Diagnóza, lokalizace nemoci, léčba, alergie a další údaje, které asistent používá při každé analýze.",
      },
      { property: "og:title", content: "Zdravotní profil — IBD Kompas" },
      {
        property: "og:description",
        content: "Základní zdravotní údaje pro dlouhodobé sledování IBD.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <ProfilePage />
      </AppShell>
    </RequireAuth>
  ),
});

const fields = [
  { key: "diagnosis", label: "Diagnóza", hint: "např. Crohnova choroba, ulcerózní kolitida" },
  { key: "diagnosis_year", label: "Rok diagnózy", hint: "např. 2019", numeric: true },
  {
    key: "disease_location",
    label: "Lokalizace nemoci",
    hint: "např. terminální ileum, ileokolická forma, perianální postižení",
  },
  {
    key: "current_treatment",
    label: "Současná léčba",
    hint: "léky, dávky, jak dlouho",
    long: true,
  },
  { key: "past_treatment", label: "Předchozí léčba", hint: "co bylo zkoušeno a proč skončilo", long: true },
  { key: "surgeries", label: "Operace a výkony", hint: "resekce, stomie, drenáže, datum", long: true },
  { key: "other_conditions", label: "Další nemoci", hint: "např. anémie, artritida, štítná žláza", long: true },
  { key: "allergies", label: "Alergie a intolerance", hint: "léky, potraviny", long: true },
  { key: "supplements", label: "Doplňky stravy", hint: "železo, vitamin D, B12…", long: true },
  { key: "smoking", label: "Kouření", hint: "nekuřák / kuřák / bývalý kuřák, kolik" },
  { key: "notes", label: "Další poznámky", hint: "cokoli důležitého pro dlouhodobé sledování", long: true },
] as const;

function ProfilePage() {
  const { user } = useAuthSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("health_profile").select("*").maybeSingle();
    if (error) {
      toast.error("Načtení profilu selhalo: " + error.message);
      return;
    }
    if (!data) return;
    const next: Record<string, string> = {};
    for (const field of fields) {
      const value = data[field.key];
      next[field.key] = value === null || value === undefined ? "" : String(value);
    }
    setValues(next);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload: Record<string, unknown> = { user_id: user.id };
    for (const field of fields) {
      const raw = (values[field.key] ?? "").trim();
      if ("numeric" in field && field.numeric) {
        payload[field.key] = raw === "" ? null : Number(raw);
      } else {
        payload[field.key] = raw === "" ? null : raw;
      }
    }
    const { error } = await supabase
      .from("health_profile")
      .upsert(payload as never, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("Uložení selhalo: " + error.message);
      return;
    }
    toast.success("Profil uložen");
  }

  return (
    <section className="panel p-5">
      <h1 className="text-xl font-semibold">Zdravotní profil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tyto údaje má asistent k dispozici při každé analýze. Vyplňujte postupně — i částečný
        profil pomůže.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className={"long" in field && field.long ? "sm:col-span-2" : ""}>
            <label className="text-xs font-semibold text-muted-foreground" htmlFor={field.key}>
              {field.label}
            </label>
            {"long" in field && field.long ? (
              <textarea
                id={field.key}
                rows={3}
                placeholder={field.hint}
                className="field field-focus mt-1 resize-none"
                value={values[field.key] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [field.key]: e.target.value }))}
              />
            ) : (
              <input
                id={field.key}
                placeholder={field.hint}
                className="field field-focus mt-1"
                value={values[field.key] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [field.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving} className="btn-primary mt-5">
        {saving ? "Ukládám…" : "Uložit profil"}
      </button>
    </section>
  );
}
