import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const TYPES = [
  { v: "conducta", l: "Conducta antideportiva" },
  { v: "arbitraje", l: "Fallo del arbitraje" },
  { v: "planilla", l: "Error en planilla" },
  { v: "cancha", l: "Estado de la cancha / logística" },
  { v: "otro", l: "Otro" },
];

export function ObservacionDialog({
  match,
  teamId,
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  match: any | null;
  teamId: string;
  editing?: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}) {
  const [type, setType] = useState("conducta");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = !!editing;

  useEffect(() => {
    if (open) {
      setType(editing?.observation_type ?? "conducta");
      setDesc(editing?.description ?? "");
    }
  }, [open, editing?.id]);

  const targetMatch = match ?? editing?.match ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar observación" : "Nueva observación al comité"}</DialogTitle>
        </DialogHeader>
        {targetMatch && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div className="font-semibold">Partido</div>
            <div>{targetMatch.home?.name ?? "—"} vs {targetMatch.away?.name ?? "—"}</div>
          </div>
        )}
        <div>
          <Label>Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Descripción</Label>
          <Textarea
            rows={6}
            placeholder="Describí lo ocurrido con el mayor detalle posible."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={saving || desc.trim().length < 10}
            onClick={async () => {
              setSaving(true);
              try {
                if (isEdit) {
                  const { error } = await (supabase as any).from("match_observations")
                    .update({ observation_type: type, description: desc.trim(), content: desc.trim() })
                    .eq("id", editing.id);
                  if (error) throw error;
                  toast.success("Observación actualizada");
                } else {
                  if (!match) return;
                  // Bloquear múltiples pendientes por partido/equipo
                  const { data: existing } = await (supabase as any).from("match_observations")
                    .select("id").eq("match_id", match.id).eq("team_id", teamId).eq("status", "pendiente").limit(1);
                  if ((existing ?? []).length > 0) {
                    toast.error("Ya existe una observación pendiente para este partido. Editala o esperá la respuesta del comité.");
                    setSaving(false);
                    return;
                  }
                  const { data: userData } = await supabase.auth.getUser();
                  const uid = userData.user?.id ?? null;
                  const { error } = await (supabase as any).from("match_observations").insert({
                    match_id: match.id,
                    team_id: teamId,
                    observation_type: type,
                    description: desc.trim(),
                    content: desc.trim(),
                    status: "pendiente",
                    created_by: uid,
                    user_id: uid,
                  });
                  if (error) throw error;
                  toast.success("Observación enviada al comité");
                }
                setDesc("");
                setType("conducta");
                onSaved?.();
                onOpenChange(false);
              } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
            }}
          >{saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Enviar observación"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
