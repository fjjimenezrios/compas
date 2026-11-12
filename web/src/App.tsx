import { useEffect, useState } from "react";
import { ChordsPage } from "./components/ChordsPage";
import { DocPalo, DocsIndex } from "./components/Docs";
import { Library } from "./components/Library";
import { MetronomePage } from "./components/MetronomePage";
import { QuizPage } from "./components/Quiz";
import { SongView } from "./components/SongView";
import { saveTheme, savedTheme, systemTheme, type Theme } from "./theme";

export type Route =
  | { view: "library" }
  | { view: "song"; slug: string }
  | { view: "docs"; id?: string }
  | { view: "metronome"; id?: string }
  | { view: "chords"; tab?: string }
  | { view: "quiz"; id?: string };

export function parseRoute(hash: string): Route {
  const path = decodeURIComponent(hash.replace(/^#/, ""));
  const [head, id] = path.split("/");
  if (head === "doc") return { view: "docs", id };
  if (head === "metronomo") return { view: "metronome", id };
  if (head === "acordes") return { view: "chords", tab: id };
  if (head === "test") return { view: "quiz", id };
  return path ? { view: "song", slug: path } : { view: "library" };
}

const NAV: { view: Route["view"]; href: string; label: string; short?: string }[] = [
  { view: "library", href: "#", label: "Biblioteca" },
  { view: "docs", href: "#doc", label: "Documentación", short: "Docs" },
  { view: "metronome", href: "#metronomo", label: "Metrónomo" },
  { view: "chords", href: "#acordes", label: "Acordes" },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme());
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      className="theme-toggle"
      onClick={() => {
        saveTheme(next);
        setTheme(next);
      }}
      aria-label={next === "light" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={next === "light" ? "Modo claro" : "Modo oscuro"}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * 2 * Math.PI;
            return <line key={i} x1={12 + 7.5 * Math.cos(a)} y1={12 + 7.5 * Math.sin(a)} x2={12 + 10 * Math.cos(a)} y2={12 + 10 * Math.sin(a)} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />;
          })}
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
        </svg>
      )}
      <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
    </button>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.view) {
    case "song":
      return <SongView key={route.slug} slug={route.slug} />;
    case "docs":
      return route.id ? <DocPalo key={route.id} id={route.id} /> : <DocsIndex />;
    case "metronome":
      return <MetronomePage paloId={route.id} />;
    case "chords":
      return <ChordsPage tab={route.tab} />;
    case "quiz":
      return <QuizPage paloId={route.id} />;
    default:
      return <Library />;
  }
}

export function App() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  // A song page belongs to the library, the test to the documentation.
  const section = route.view === "song" ? "library" : route.view === "quiz" ? "docs" : route.view;

  return (
    <div className="app">
      <header className="topbar">
        <a href="#" className="brand">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
              const accent = [0, 3, 6, 8, 10].includes(i);
              return <circle key={i} cx={12 + 9 * Math.cos(a)} cy={12 + 9 * Math.sin(a)} r={accent ? 2.2 : 1.1} fill={accent ? "var(--accent)" : "var(--muted)"} />;
            })}
          </svg>
          Compás
        </a>
        <nav className="nav" aria-label="Secciones">
          {NAV.map((n) => (
            <a key={n.view} href={n.href} aria-current={section === n.view ? "page" : undefined}>
              <span className={n.short ? "nav-full" : undefined}>{n.label}</span>
              {n.short && <span className="nav-short" aria-hidden="true">{n.short}</span>}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </header>
      <main>
        <Page route={route} />
      </main>
      <footer className="credits">
        <p>
          Palmas: <a href="https://commons.wikimedia.org/wiki/Category:Flamenco_samples_by_Santiago_S%C3%A1nchez_Cifuentes" target="_blank" rel="noopener noreferrer">Santiago Sánchez Cifuentes</a> (CC0).
          Cajón: <a href="https://freesound.org/people/OldBassMan/packs/9321/" target="_blank" rel="noopener noreferrer">OldBassMan</a> en Freesound (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>).
          Recortados y normalizados.
        </p>
      </footer>
    </div>
  );
}
