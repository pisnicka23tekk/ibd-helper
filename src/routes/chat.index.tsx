import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { AppShell, RequireAuth } from "@/components/AppShell";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      { title: "Konzultace — IBD Kompas" },
      {
        name: "description",
        content: "Vaše konzultace s multidisciplinárním IBD asistentem.",
      },
      { property: "og:title", content: "Konzultace — IBD Kompas" },
      { property: "og:description", content: "Konzultace a dlouhodobá analýza vašeho IBD." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <ChatIndex />
      </AppShell>
    </RequireAuth>
  ),
});

function ChatIndex() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const started = useRef(false);

  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;

    (async () => {
      const { data: existing, error } = await supabase
        .from("threads")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) {
        toast.error("Nepodařilo se načíst konzultace: " + error.message);
        return;
      }

      if (existing && existing.length > 0) {
        navigate({ to: "/chat/$threadId", params: { threadId: existing[0].id }, replace: true });
        return;
      }

      const { data: created, error: createError } = await supabase
        .from("threads")
        .insert({ user_id: user.id, title: "Výchozí zdravotní profil" })
        .select("id")
        .single();

      if (createError || !created) {
        toast.error("Nepodařilo se vytvořit konzultaci: " + (createError?.message ?? ""));
        return;
      }

      navigate({ to: "/chat/$threadId", params: { threadId: created.id }, replace: true });
    })();
  }, [user, navigate]);

  return <p className="text-sm text-muted-foreground">Připravuji konzultaci…</p>;
}
