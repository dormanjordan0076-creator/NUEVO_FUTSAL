import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "active_championship_id";

type ChampionshipRow = {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
  status: string | null;
  logo_url: string | null;
  cover_url: string | null;
  season: string | null;
  description: string | null;
  location: string | null;
  organizer: string | null;
  start_date: string | null;
  end_date: string | null;
  yellow_cards_for_suspension?: number | null;
  red_card_suspension_matches?: number | null;
  [key: string]: any;
};

type Ctx = {
  activeId: string | null;
  active: ChampionshipRow | null;
  setActive: (id: string | null) => void;
  championships: ChampionshipRow[];
  loading: boolean;
};

const ChampionshipCtx = createContext<Ctx>({
  activeId: null,
  active: null,
  setActive: () => {},
  championships: [],
  loading: true,
});

export function ChampionshipProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveIdState(localStorage.getItem(STORAGE_KEY));
  }, []);

  const query = useQuery({
    queryKey: ["public", "championships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("championships")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ChampionshipRow[];
    },
  });

  const championships = query.data ?? [];

  // Nota: no seteamos un default automáticamente para que el usuario
  // pase primero por la pantalla /campeonatos y elija explícitamente.
  // Sólo restauramos lo que ya haya en localStorage (arriba).

  const setActive = (id: string | null) => {
    setActiveIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const active = championships.find((c) => c.id === activeId) ?? null;

  return (
    <ChampionshipCtx.Provider value={{ activeId, active, setActive, championships, loading: query.isLoading }}>
      {children}
    </ChampionshipCtx.Provider>
  );
}

export function useActiveChampionship() {
  return useContext(ChampionshipCtx);
}
