import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, LogOut, MessageSquare, NotebookPen, User } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";

const navItems = [
  { to: "/chat", label: "Konzultace", icon: MessageSquare },
  { to: "/dennik", label: "Deník a trendy", icon: NotebookPen },
  { to: "/profil", label: "Zdravotní profil", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user } = useAuthSession();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/chat" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-4" />
            </span>
            <span className="font-display">IBD Kompas</span>
          </Link>
          <nav className="ml-2 flex flex-1 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground [&.active]:font-semibold"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          {user ? (
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="btn-ghost"
              aria-label="Odhlásit se"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Odhlásit</span>
            </button>
          ) : null}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">{children}</main>
      <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
        Analytická podpora, ne lékařská péče. Při varovných příznacích kontaktujte lékaře nebo
        záchrannou službu.
      </footer>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuthSession();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Načítám…
      </div>
    );
  }

  if (!user) {
    navigate({ to: "/auth" });
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Přesměrovávám na přihlášení…
      </div>
    );
  }

  return <>{children}</>;
}
