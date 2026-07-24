import { Link, useRouterState } from "@tanstack/react-router";
import { Trophy, Moon, Sun, LogIn, LogOut, ShieldCheck, Users, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useActiveChampionship } from "@/lib/championship";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

const PUBLIC_LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/fixture", label: "Fixture" },
  { to: "/tabla", label: "Tabla" },
  { to: "/estadisticas", label: "Estadísticas" },
  { to: "/resoluciones", label: "Resoluciones" },
];

export function Header() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin, isDelegado, delegateTeamId, loading } = useAuth();
  const { active, championships, setActive } = useActiveChampionship();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", prefersDark);
    setDark(prefersDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-pitch text-pitch-foreground shadow-elevated">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-black uppercase tracking-tight">Integración</div>
            <div className="-mt-0.5 truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Futsal Pro</div>
          </div>
        </Link>

        <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex">
          {active && path !== "/campeonatos" && PUBLIC_LINKS.map((l) => {
            const isActive = path === l.to || (l.to !== "/" && path.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {!loading && user && active && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden max-w-[200px] gap-1.5 sm:inline-flex">
                  <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate text-xs font-semibold">{active.name}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Cambiar de campeonato</DropdownMenuLabel>
                {championships.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => setActive(c.id)} className={c.id === active.id ? "bg-primary/10 font-semibold" : ""}>
                    <Trophy className="mr-2 h-3.5 w-3.5" /> <span className="truncate">{c.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/campeonatos">Ver todos mis campeonatos</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {!loading && isAdmin && (
            <Link to="/admin">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Admin
              </Button>
            </Link>
          )}
          {!loading && isDelegado && delegateTeamId && (
            <Link to="/mi-equipo">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <Users className="h-4 w-4" /> Mi equipo
              </Button>
            </Link>
          )}
          {!loading && !user && (
            <Link to="/auth">
              <Button size="sm" variant="outline" className="gap-1.5">
                <LogIn className="h-4 w-4" /> Ingresar
              </Button>
            </Link>
          )}
          {!loading && user && (
            <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Salir">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {active && path !== "/campeonatos" && (
        <nav className="no-print flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
          {PUBLIC_LINKS.map((l) => {
            const isActive = path === l.to || (l.to !== "/" && path.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
