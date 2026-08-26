import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { AppShell, RequireAuth } from "@/components/AppShell";
import type { DailyLog, LabResult } from "@/lib/health-context";

export const Route = createFileRoute("/dennik")({
  head: () => ({
    meta: [
      { title: "Deník a trendy — IBD Kompas" },
      {
        name: "description",
        content:
          "Denní záznam symptomů, hmotnosti, spánku a stresu plus laboratorní hodnoty v grafech.",
      },
      { property: "og:title", content: "Deník a trendy — IBD Kompas" },
      {
        property: "og:description",
        content: "Sledujte bolest, stolici, hmotnost, CRP a kalprotektin v čase.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <Journal />
      </AppShell>
    </RequireAuth>
  ),
});

const numberFields = [
  { key: "pain_level", label: "Bolest (0–10)", min: 0, max: 10 },
  { key: "stool_count", label: "Počet stolic", min: 0, max: 40 },
  { key: "stool_consistency", label: "Konzistence (Bristol 1–7)", min: 1, max: 7 },
  { key: "bloating", label: "Nadýmání (0–10)", min: 0, max: 10 },
  { key: "nausea", label: "Nevolnost (0–10)", min: 0, max: 10 },
  { key: "appetite", label: "Chuť k jídlu (0–10)", min: 0, max: 10 },
  { key: "fatigue", label: "Únava (0–10)", min: 0, max: 10 },
  { key: "stress", label: "Stres (0–10)", min: 0, max: 10 },
  { key: "mood", label: "Nálada (0–10)", min: 0, max: 10 },
  { key: "sleep_quality", label: "Kvalita spánku (0–10)", min: 0, max: 10 },
  { key: "activity_minutes", label: "Pohyb (min)", min: 0, max: 600 },
] as const;

const decimalFields = [
  { key: "weight_kg", label: "Hmotnost (kg)", step: "0.1" },
  { key: "temperature_c", label: "Teplota (°C)", step: "0.1" },
  { key: "sleep_hours", label: "Spánek (h)", step: "0.5" },
  { key: "hydration_liters", label: "Tekutiny (l)", step: "0.1" },
] as const;

const boolFields = [
  { key: "blood", label: "Krev ve stolici" },
  { key: "mucus", label: "Hlen" },
  { key: "urgency", label: "Urgence" },
  { key: "alcohol", label: "Alkohol" },
  { key: "smoking", label: "Kouření" },
] as const;

const textFields = [
  { key: "pain_location", label: "Lokalizace bolesti" },
  { key: "foods", label: "Jídlo / co jsem snědl(a)" },
  { key: "medications", label: "Léky a doplňky dnes" },
  { key: "notes", label: "Poznámky" },
] as const;

const trendOptions = [
  { key: "pain_level", label: "Bolest" },
  { key: "stool_count", label: "Počet stolic" },
  { key: "fatigue", label: "Únava" },
  { key: "stress", label: "Stres" },
  { key: "weight_kg", label: "Hmotnost" },
  { key: "sleep_hours", label: "Spánek" },
] as const;

type FormState = Record<string, string | boolean>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function Journal() {
  const { user } = useAuthSession();
  const [tab, setTab] = useState<"log" | "trends" | "labs">("log");
  const [date, setDate] = useState(today());
  const [form, setForm] = useState<FormState>({});
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    const [logsRes, labsRes] = await Promise.all([
      supabase.from("daily_logs").select("*").order("log_date", { ascending: false }).limit(180),
      supabase.from("lab_results").select("*").order("taken_on", { ascending: false }).limit(200),
    ]);
    if (logsRes.error) toast.error("Deník: " + logsRes.error.message);
    if (labsRes.error) toast.error("Laborky: " + labsRes.error.message);
    setLogs(logsRes.data ?? []);
    setLabs(labsRes.data ?? []);
  }, []);

  useEffect(() => {
    if (user) void loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    const existing = logs.find((l) => l.log_date === date);
    if (!existing) {
      setForm({});
      return;
    }
    const next: FormState = {};
    for (const [key, value] of Object.entries(existing)) {
      if (typeof value === "boolean") next[key] = value;
      else if (value !== null && value !== undefined) next[key] = String(value);
    }
    setForm(next);
  }, [date, logs]);

  function set(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveLog() {
    if (!user) return;
    setSaving(true);
    const payload: Record<string, unknown> = { user_id: user.id, log_date: date };
    for (const field of [...numberFields, ...decimalFields]) {
      const raw = form[field.key];
      payload[field.key] = typeof raw === "string" && raw !== "" ? Number(raw) : null;
    }
    for (const field of boolFields) payload[field.key] = form[field.key] === true;
    for (const field of textFields) {
      const raw = form[field.key];
      payload[field.key] = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
    }

    const { error } = await supabase
      .from("daily_logs")
      .upsert(payload as never, { onConflict: "user_id,log_date" });
    setSaving(false);
    if (error) {
      toast.error("Uložení selhalo: " + error.message);
      return;
    }
    toast.success("Záznam uložen");
    void loadAll();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["log", "Denní záznam"],
            ["trends", "Trendy"],
            ["labs", "Laboratorní výsledky"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={tab === key ? "btn-primary" : "btn-ghost"}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <section className="panel p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Denní záznam</h1>
              <p className="text-sm text-muted-foreground">
                Vyplňte jen to, co víte. Prázdné hodnoty se neukládají.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="log-date">
                Datum
              </label>
              <input
                id="log-date"
                type="date"
                className="field field-focus mt-1"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {numberFields.map((field) => (
              <div key={field.key}>
                <label
                  className="text-xs font-semibold text-muted-foreground"
                  htmlFor={`f-${field.key}`}
                >
                  {field.label}
                </label>
                <input
                  id={`f-${field.key}`}
                  type="number"
                  min={field.min}
                  max={field.max}
                  className="field field-focus mt-1"
                  value={(form[field.key] as string) ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              </div>
            ))}
            {decimalFields.map((field) => (
              <div key={field.key}>
                <label
                  className="text-xs font-semibold text-muted-foreground"
                  htmlFor={`f-${field.key}`}
                >
                  {field.label}
                </label>
                <input
                  id={`f-${field.key}`}
                  type="number"
                  step={field.step}
                  className="field field-focus mt-1"
                  value={(form[field.key] as string) ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            {boolFields.map((field) => (
              <label key={field.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={form[field.key] === true}
                  onChange={(e) => set(field.key, e.target.checked)}
                />
                {field.label}
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {textFields.map((field) => (
              <div key={field.key}>
                <label
                  className="text-xs font-semibold text-muted-foreground"
                  htmlFor={`f-${field.key}`}
                >
                  {field.label}
                </label>
                <textarea
                  id={`f-${field.key}`}
                  rows={2}
                  className="field field-focus mt-1 resize-none"
                  value={(form[field.key] as string) ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <button onClick={saveLog} disabled={saving} className="btn-primary mt-5">
            {saving ? "Ukládám…" : "Uložit záznam"}
          </button>
        </section>
      ) : null}

      {tab === "trends" ? <Trends logs={logs} labs={labs} /> : null}
      {tab === "labs" ? <Labs labs={labs} onChanged={loadAll} /> : null}
    </div>
  );
}

function Trends({ logs, labs }: { logs: DailyLog[]; labs: LabResult[] }) {
  const [metric, setMetric] = useState<(typeof trendOptions)[number]["key"]>("pain_level");
  const [marker, setMarker] = useState<string>("");

  const markers = useMemo(
    () => Array.from(new Set(labs.map((l) => l.marker))).sort((a, b) => a.localeCompare(b, "cs")),
    [labs],
  );

  useEffect(() => {
    if (!marker && markers.length > 0) setMarker(markers[0]);
  }, [markers, marker]);

  const logData = useMemo(
    () =>
      [...logs]
        .sort((a, b) => a.log_date.localeCompare(b.log_date))
        .map((log) => ({
          date: log.log_date.slice(5),
          value: log[metric] === null ? null : Number(log[metric]),
        })),
    [logs, metric],
  );

  const labData = useMemo(
    () =>
      labs
        .filter((l) => l.marker === marker && l.value !== null)
        .sort((a, b) => a.taken_on.localeCompare(b.taken_on))
        .map((l) => ({ date: l.taken_on, value: Number(l.value) })),
    [labs, marker],
  );

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Trend z deníku</h2>
          <select
            className="field field-focus w-auto"
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
            aria-label="Vyberte ukazatel"
          >
            {trendOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {logData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Zatím nejsou žádné záznamy. Vyplňte denní záznam.
          </p>
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logData}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Laboratorní trend</h2>
          <select
            className="field field-focus w-auto"
            value={marker}
            onChange={(e) => setMarker(e.target.value)}
            aria-label="Vyberte laboratorní ukazatel"
          >
            {markers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {labData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Zadejte laboratorní hodnoty v záložce „Laboratorní výsledky“.
          </p>
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={labData}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

const commonMarkers = [
  "CRP",
  "Fekální kalprotektin",
  "Hemoglobin",
  "Leukocyty",
  "Trombocyty",
  "Ferritin",
  "Železo",
  "Vitamin B12",
  "Folát",
  "Vitamin D",
  "Albumin",
  "ALT",
  "AST",
  "Kreatinin",
  "Sedimentace",
];

function Labs({ labs, onChanged }: { labs: LabResult[]; onChanged: () => void }) {
  const { user } = useAuthSession();
  const [takenOn, setTakenOn] = useState(today());
  const [marker, setMarker] = useState("CRP");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");

  async function add() {
    if (!user || !marker.trim()) return;
    const { error } = await supabase.from("lab_results").insert({
      user_id: user.id,
      taken_on: takenOn,
      marker: marker.trim(),
      value: value === "" ? null : Number(value),
      unit: unit.trim() || null,
      note: note.trim() || null,
    });
    if (error) {
      toast.error("Uložení selhalo: " + error.message);
      return;
    }
    setValue("");
    setNote("");
    toast.success("Hodnota uložena");
    onChanged();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("lab_results").delete().eq("id", id);
    if (error) {
      toast.error("Smazání selhalo: " + error.message);
      return;
    }
    onChanged();
  }

  return (
    <section className="panel p-5">
      <h1 className="text-xl font-semibold">Laboratorní výsledky</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="lab-date">
            Datum
          </label>
          <input
            id="lab-date"
            type="date"
            className="field field-focus mt-1"
            value={takenOn}
            onChange={(e) => setTakenOn(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="lab-marker">
            Ukazatel
          </label>
          <input
            id="lab-marker"
            list="lab-markers"
            className="field field-focus mt-1"
            value={marker}
            onChange={(e) => setMarker(e.target.value)}
          />
          <datalist id="lab-markers">
            {commonMarkers.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="lab-value">
            Hodnota
          </label>
          <input
            id="lab-value"
            type="number"
            step="0.01"
            className="field field-focus mt-1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="lab-unit">
            Jednotka
          </label>
          <input
            id="lab-unit"
            className="field field-focus mt-1"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="lab-note">
            Poznámka
          </label>
          <input
            id="lab-note"
            className="field field-focus mt-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <button onClick={add} className="btn-primary mt-4">
        Přidat hodnotu
      </button>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2">Datum</th>
              <th className="py-2">Ukazatel</th>
              <th className="py-2">Hodnota</th>
              <th className="py-2">Poznámka</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {labs.map((lab) => (
              <tr key={lab.id} className="border-t border-border">
                <td className="py-2">{lab.taken_on}</td>
                <td className="py-2">{lab.marker}</td>
                <td className="py-2">
                  {lab.value ?? "—"} {lab.unit ?? ""}
                </td>
                <td className="py-2 text-muted-foreground">{lab.note ?? ""}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => remove(lab.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
