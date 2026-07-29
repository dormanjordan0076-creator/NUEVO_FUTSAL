import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TeamBadge } from "@/components/TeamBadge";
import { Button } from "@/components/ui/button";
import { Printer, Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/planilla/$matchId")({
  head: () => ({ meta: [{ title: "Planilla oficial · Integración Futsal" }] }),
  component: PlanillaPage,
});

function PlanillaPage() {
  const { matchId } = Route.useParams();
  const match = useQuery({
    queryKey: ["planilla", matchId],
    queryFn: async () => (await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()).data,
  });
  const homeId = match.data?.home_team_id;
  const awayId = match.data?.away_team_id;
  const teams = useQuery({
    queryKey: ["planilla-teams", homeId, awayId],
    queryFn: async () => (await supabase.from("teams").select("*").in("id", [homeId, awayId].filter(Boolean) as string[])).data ?? [],
    enabled: !!(homeId || awayId),
  });
  const players = useQuery({
    queryKey: ["planilla-players", homeId, awayId],
    queryFn: async () => (await supabase.from("players").select("*").in("team_id", [homeId, awayId].filter(Boolean) as string[]).eq("enabled", true).order("jersey_number")).data ?? [],
    enabled: !!(homeId || awayId),
  });
  const categories = useQuery({
    queryKey: ["planilla-cats"],
    queryFn: async () => (await supabase.from("categories").select("id,name")).data ?? [],
  });

  const m: any = match.data;
  const [meta, setMeta] = useState({
    match_date: "", venue: "", category: "", phase: "", group_name: "", match_number: "",
    referee_main: "", referee_second: "", timekeeper: "", control_table: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!m) return;
    const cat = categories.data?.find((c: any) => c.id === m.category_id);
    setMeta({
      match_date: m.match_date ? format(new Date(m.match_date), "yyyy-MM-dd'T'HH:mm") : "",
      venue: m.venue ?? "",
      category: cat?.name ?? "",
      phase: m.phase ?? "",
      group_name: m.group_name ?? "",
      match_number: m.match_number ?? "",
      referee_main: m.referee_main ?? "",
      referee_second: m.referee_second ?? "",
      timekeeper: m.timekeeper ?? "",
      control_table: m.control_table ?? "",
    });
  }, [m, categories.data]);

  async function guardar() {
    if (!m) return;
    setSaving(true);
    try {
      const payload: any = {
        match_date: meta.match_date ? new Date(meta.match_date).toISOString() : null,
        venue: meta.venue || null,
        phase: meta.phase || m.phase,
        group_name: meta.group_name || null,
        match_number: meta.match_number || null,
        referee_main: meta.referee_main || null,
        referee_second: meta.referee_second || null,
        timekeeper: meta.timekeeper || null,
        control_table: meta.control_table || null,
      };
      const { error } = await supabase.from("matches").update(payload).eq("id", m.id);
      if (error) throw error;
      toast.success("Datos guardados");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  if (!match.data) return <div className="p-10 text-center">Partido no encontrado</div>;
  const home = teams.data?.find((t) => t.id === homeId);
  const away = teams.data?.find((t) => t.id === awayId);
  const homePlayers = players.data?.filter((p) => p.id === homeId) ?? [];
  const awayPlayers = players.data?.filter((p) => p.id === awayId) ?? [];

  return (
    <div className="planilla-wrap mx-auto max-w-[215.9mm] px-3 py-4">
      <style>{`
        @page { size: Letter portrait; margin: 8mm; }
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .planilla-wrap { padding: 0 !important; max-width: 100% !important; }
          .planilla-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; page-break-inside: avoid; }
          input, .cell-input { border: none !important; background: transparent !important; padding: 0 !important; }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .planilla-sheet { font-family: ui-sans-serif, system-ui, sans-serif; color: #000; font-size: 8.5px; }
        .planilla-sheet input.cell-input {
          border: none; background: transparent; padding: 0 2px; font-size: 8.5px;
          width: 100%; outline: none;
        }
        .planilla-sheet input.cell-input:focus { background: #fef9c3; }
        .p-table { border-collapse: collapse; width: 100%; font-size: 8.5px; }
        .p-table th, .p-table td { border: 1px solid #000; padding: 1px 2px; }
        .p-table th { background: #000; color: #fff; text-transform: uppercase; font-size: 7.5px; letter-spacing: 0.03em; }
        .p-row { height: 14px; }
        .p-box { border: 1px solid #000; }
        .p-header-title { border: 2px solid #000; }
      `}</style>

      <div className="no-print mb-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={guardar} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar datos"}
        </Button>
        <Button size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      <div className="planilla-sheet planilla-sheet bg-white p-4 border border-black">
        {/* ENCABEZADO */}
        <div className="p-header-title text-center py-2 mb-2">
          <div className="text-[13px] font-black tracking-wide">CAMPEONATO INTEGRACIÓN PROFESIONAL FUTSAL</div>
          <div className="text-[11px] font-bold tracking-widest">PLANILLA OFICIAL DEL PARTIDO</div>
        </div>

        {/* DATOS DEL PARTIDO */}
        <table className="p-table mb-2">
          <tbody>
            <tr>
              <th className="w-[70px]">Fecha</th>
              <td colSpan={2}><input className="cell-input" type="datetime-local" value={meta.match_date} onChange={(e) => setMeta({ ...meta, match_date: e.target.value })} /></td>
              <th className="w-[70px]">Cancha</th>
              <td colSpan={2}><input className="cell-input" value={meta.venue} onChange={(e) => setMeta({ ...meta, venue: e.target.value })} /></td>
              <th className="w-[60px]">N° Partido</th>
              <td><input className="cell-input" value={meta.match_number} onChange={(e) => setMeta({ ...meta, match_number: e.target.value })} /></td>
            </tr>
            <tr>
              <th>Categoría</th>
              <td colSpan={2}><input className="cell-input" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} /></td>
              <th>Fase</th>
              <td colSpan={2}><input className="cell-input" value={meta.phase} onChange={(e) => setMeta({ ...meta, phase: e.target.value })} /></td>
              <th>Grupo</th>
              <td><input className="cell-input" value={meta.group_name} onChange={(e) => setMeta({ ...meta, group_name: e.target.value })} /></td>
            </tr>
            <tr>
              <th>Árbitro Principal</th>
              <td colSpan={2}><input className="cell-input" value={meta.referee_main} onChange={(e) => setMeta({ ...meta, referee_main: e.target.value })} /></td>
              <th>Segundo Árbitro</th>
              <td colSpan={2}><input className="cell-input" value={meta.referee_second} onChange={(e) => setMeta({ ...meta, referee_second: e.target.value })} /></td>
              <th>Cronometrador</th>
              <td><input className="cell-input" value={meta.timekeeper} onChange={(e) => setMeta({ ...meta, timekeeper: e.target.value })} /></td>
            </tr>
            <tr>
              <th>Mesa de Control</th>
              <td colSpan={7}><input className="cell-input" value={meta.control_table} onChange={(e) => setMeta({ ...meta, control_table: e.target.value })} /></td>
            </tr>
          </tbody>
        </table>

        {/* EQUIPOS */}
        <TeamBlock label="EQUIPO LOCAL" team={home} players={homePlayers} />
        <div className="h-3" />
        <TeamBlock label="EQUIPO VISITANTE" team={away} players={awayPlayers} />

        {/* RESULTADO */}
        <div className="mt-3 p-box p-2">
          <div className="text-center text-[11px] font-black tracking-widest mb-1">RESULTADO FINAL</div>
          <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-2 text-center">
            <div className="text-[11px] font-bold uppercase">{home?.name ?? "Local"}</div>
            <div className="w-14 h-10 p-box flex items-center justify-center text-2xl font-black tabular-nums">{m.home_score ?? ""}</div>
            <div className="text-xs font-black">VS</div>
            <div className="w-14 h-10 p-box flex items-center justify-center text-2xl font-black tabular-nums">{m.away_score ?? ""}</div>
            <div className="text-[11px] font-bold uppercase">{away?.name ?? "Visitante"}</div>
          </div>
        </div>

        {/* OBSERVACIONES */}
        <div className="mt-3">
          <div className="text-[10px] font-black tracking-widest uppercase mb-1">Observaciones del partido</div>
          <div className="p-box h-24"></div>
        </div>

        {/* FIRMAS */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[10px]">
          {["Firma Delegado Local", "Firma Delegado Visitante", "Firma Encargado de Mesa"].map((l, i) => (
            <div key={i}>
              <div className="h-10 border-b border-black"></div>
              <div className="mt-1 font-bold uppercase">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamBlock({ label, team }: { label: string; team: any; players?: any[] }) {
  const rows = 14;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="text-[10px] font-black tracking-widest uppercase">{label}</div>
        <div className="flex-1 border-b border-black" />
      </div>
      <div className="flex items-start gap-2">
        {team && <TeamBadge name={team.name ?? "?"} logoPath={team.logo_url} color={team.primary_color} size={40} />}
        <div className="flex-1">
          <table className="p-table">
            <tbody>
              <tr>
                <th className="w-[70px]">Nombre</th>
                <td colSpan={3}><div className="text-[11px] font-bold py-0.5">{team?.name ?? ""}</div></td>
                <th className="w-[70px]">Delegado</th>
                <td colSpan={3}><input className="cell-input" defaultValue={team?.delegate_name ?? ""} /></td>
              </tr>
              <tr>
                <th>Entrenador</th>
                <td colSpan={3}><input className="cell-input" /></td>
                <th>Capitán</th>
                <td colSpan={3}><input className="cell-input" /></td>
              </tr>
              <tr>
                <th>Faltas 1T</th>
                <td>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((n) => <span key={n} className="inline-block w-4 h-4 border border-black"></span>)}
                  </div>
                </td>
                <th className="w-[70px]">Faltas 2T</th>
                <td colSpan={5}>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((n) => <span key={n} className="inline-block w-4 h-4 border border-black"></span>)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <table className="p-table mt-1" style={{ tableLayout: "fixed", width: "100%" }}>
        <thead>
          <tr>
            <th className="w-[22px]">#</th>
            <th className="text-left" style={{ width: "auto" }}>Jugador</th>
            <th className="w-[52px]">Goles</th>
            <th className="w-[20px]">TA</th>
            <th className="w-[20px]">TR</th>
            <th className="w-[28px]">Faltas</th>
            <th className="text-left w-[42%]">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="p-row">
              <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
