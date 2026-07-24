import { supabase } from "@/integrations/supabase/client";

export type PhaseKind = "grupos" | "liga" | "eliminacion" | "ida_vuelta" | "manual";

export type Phase = {
  id: string;
  championship_id: string;
  category_id: string;
  name: string;
  kind: PhaseKind;
  display_order: number;
  status: "active" | "archived";
  created_at: string;
};

export type PhaseParticipant = {
  id: string;
  phase_id: string;
  team_id: string;
  seed: number | null;
};

export const PHASE_KINDS: { value: PhaseKind; label: string }[] = [
  { value: "grupos", label: "Grupos" },
  { value: "liga", label: "Liga (todos contra todos)" },
  { value: "ida_vuelta", label: "Liga ida y vuelta" },
  { value: "eliminacion", label: "Eliminación directa" },
  { value: "manual", label: "Manual" },
];

export const PHASE_PRESETS: { name: string; kind: PhaseKind }[] = [
  { name: "Grupos", kind: "grupos" },
  { name: "Liguilla", kind: "liga" },
  { name: "Consuelo", kind: "liga" },
  { name: "Octavos", kind: "eliminacion" },
  { name: "Cuartos", kind: "eliminacion" },
  { name: "Semifinal", kind: "eliminacion" },
  { name: "Final", kind: "eliminacion" },
  { name: "Tercer Lugar", kind: "eliminacion" },
];

export function isTablePhase(kind: PhaseKind): boolean {
  return kind === "grupos" || kind === "liga" || kind === "ida_vuelta";
}

export async function fetchPhases(championshipId: string, categoryId?: string): Promise<Phase[]> {
  let q: any = (supabase as any).from("phases").select("*").eq("championship_id", championshipId);
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data } = await q.order("display_order");
  return (data ?? []) as Phase[];
}

export async function countPhaseMatches(phaseId: string): Promise<number> {
  const { count } = await (supabase as any)
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("phase_id", phaseId);
  return count ?? 0;
}
