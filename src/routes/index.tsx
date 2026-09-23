import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Brain, LineChart, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IBD Kompas — multidisciplinární sledování Crohnovy choroby" },
      {
        name: "description",
        content:
          "Deník symptomů, laboratorní trendy a multidisciplinární analýza pro dlouhodobé sledování Crohnovy choroby a IBD.",
      },
      { property: "og:title", content: "IBD Kompas" },
      {
        property: "og:description",
        content:
          "Dlouhodobé sledování IBD: deník, trendy, laboratorní hodnoty a analýza z pohledu více odborností.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Brain,
    title: "Multidisciplinární pohled",
    text: "Každý problém se hodnotí z pohledu gastroenterologie, imunologie, výživy, farmakologie, psychologie, spánku i pohybu — s jasným rozlišením faktu, hypotézy a nejistoty.",
  },
  {
    icon: LineChart,
    title: "Deník a trendy",
    text: "Denní záznam bolesti, stolice, hmotnosti, spánku a stresu plus laboratorní hodnoty (CRP, kalprotektin, ferritin) v grafech.",
  },
  {
    icon: ShieldAlert,
    title: "Varovné příznaky",
    text: "Systém aktivně upozorní na možné komplikace a jasně řekne, kdy už nemá smysl čekat a je potřeba lékař.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </span>
          <span className="font-display">IBD Kompas</span>
        </div>
        <Link to="/auth" className="btn-ghost">
          Přihlásit se
        </Link>
      </header>

      <section className="mx-auto w-full max-w-4xl px-4 pt-12 pb-16 text-center">
        <p className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          Crohnova choroba · ulcerózní kolitida · IBD
        </p>
        <h1 className="mt-5 text-4xl leading-tight font-semibold sm:text-5xl">
          Dlouhodobé sledování nemoci, ne jen jednotlivé odpovědi
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
          Zaznamenávejte symptomy, léky a laboratorní výsledky. Asistent hledá trendy a skryté
          souvislosti, rozlišuje symptomy od skutečné zánětlivé aktivity a připraví vás na rozhovor
          s lékařem.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth" className="btn-primary">
            Začít sledovat
          </Link>
          <Link to="/auth" className="btn-ghost">
            Mám už účet
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 md:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="panel p-6">
            <feature.icon className="size-5 text-primary" />
            <h2 className="mt-3 text-lg font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{feature.text}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        IBD Kompas je analytický a podpůrný nástroj. Nenahrazuje lékaře, diagnózu ani akutní péči.
      </footer>
    </div>
  );
}
