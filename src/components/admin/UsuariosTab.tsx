import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listUsers, createUser, updateUser, deleteUser } from "@/lib/users.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldCheck, Flag, User as UserIcon, Copy, RefreshCw, Check } from "lucide-react";
import { useActiveChampionship } from "@/lib/championship";

const ROLES = ["admin", "delegado", "arbitro"] as const;
type Role = (typeof ROLES)[number];

const roleLabel: Record<Role, string> = {
  admin: "Administrador",
  delegado: "Delegado",
  arbitro: "Árbitro",
};

const roleBadge = (r: string) => {
  if (r === "admin") return <Badge className="bg-primary text-primary-foreground">Admin</Badge>;
  if (r === "arbitro") return <Badge className="bg-warning text-warning-foreground">Árbitro</Badge>;
  if (r === "delegado") return <Badge variant="secondary">Delegado</Badge>;
  return <Badge variant="outline">{r}</Badge>;
};

function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function UsuariosTab() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => list() });
  const { activeId } = useActiveChampionship();
  const teams = useQuery({
    queryKey: ["admin", "teams-select", activeId],
    enabled: !!activeId,
    queryFn: async () => (await supabase.from("teams").select("id,name").eq("championship_id", activeId!).order("name")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [credentialsShown, setCredentialsShown] = useState<{ email: string; password: string } | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "teams"] });
    qc.invalidateQueries({ queryKey: ["admin", "teams-select"] });
    qc.invalidateQueries({ queryKey: ["public", "teams"] });
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest">Usuarios ({users.data?.length ?? 0})</h2>
            <p className="text-xs text-muted-foreground">Al crear un delegado, el sistema genera una contraseña temporal para entregársela.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={() => setEdit(null)}>
                <Plus className="h-4 w-4" /> Nuevo usuario
              </Button>
            </DialogTrigger>
            {open && (
              <UserDialog
                key={edit?.id ?? "new"}
                user={edit}
                teams={teams.data ?? []}
                onSaved={(creds) => {
                  invalidate();
                  setOpen(false);
                  setEdit(null);
                  if (creds) setCredentialsShown(creds);
                }}
              />
            )}
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <th className="py-2 text-left">Usuario</th>
                <th className="text-left">Correo</th>
                <th className="text-left">Rol</th>
                <th className="text-left">Equipo</th>
                <th className="text-center">Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u: any) => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {u.roles.includes("admin") ? <ShieldCheck className="h-4 w-4 text-primary" /> :
                       u.roles.includes("arbitro") ? <Flag className="h-4 w-4 text-warning" /> :
                       <UserIcon className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-semibold">{u.full_name || "—"}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{u.email}</td>
                  <td className="space-x-1">{u.roles.length ? u.roles.map((r: string) => <span key={r}>{roleBadge(r)}</span>) : <span className="text-muted-foreground">—</span>}</td>
                  <td>{u.team ? <Badge variant="outline">{u.team.name}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-center">
                    {u.active
                      ? <Badge className="bg-success text-success-foreground">Activo</Badge>
                      : <Badge variant="destructive">Inactivo</Badge>}
                  </td>
                  <td className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(u); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!confirm(`Eliminar usuario "${u.email}"?`)) return;
                      try {
                        await deleteUser({ data: { user_id: u.id } });
                        toast.success("Usuario eliminado");
                        invalidate();
                      } catch (e: any) { toast.error(e.message); }
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {(users.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">
                  {users.isLoading ? "Cargando…" : "Sin usuarios registrados."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CredentialsDialog creds={credentialsShown} onClose={() => setCredentialsShown(null)} />
    </Card>
  );
}

function CredentialsDialog({ creds, onClose }: { creds: { email: string; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = creds ? `Email: ${creds.email}\nContraseña: ${creds.password}\n\nAccedé en: ${typeof window !== "undefined" ? window.location.origin : ""}/auth` : "";
  return (
    <Dialog open={!!creds} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Credenciales del delegado</DialogTitle></DialogHeader>
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <strong>Copiá estas credenciales ahora.</strong> Por seguridad no se volverán a mostrar. Pasalas al delegado para que inicie sesión.
        </div>
        {creds && (
          <div className="space-y-2">
            <div><Label>Correo</Label><Input readOnly value={creds.email} /></div>
            <div><Label>Contraseña temporal</Label><Input readOnly value={creds.password} className="font-mono" /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}>
            {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
            Copiar credenciales
          </Button>
          <Button onClick={onClose}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDialog({ user, teams, onSaved }: { user: any; teams: any[]; onSaved: (creds?: { email: string; password: string }) => void }) {
  const isEdit = !!user;
  const initialRole = (user?.roles?.[0] ?? "delegado") as Role;
  const [f, setF] = useState({
    email: user?.email ?? "",
    password: isEdit ? "" : generatePassword(),
    full_name: user?.full_name ?? "",
    role: initialRole,
    team_id: user?.team?.id ?? "",
    active: user?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Nombre completo</Label>
          <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </div>
        <div>
          <Label>Correo</Label>
          <Input type="email" value={f.email} disabled={isEdit}
            onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div>
          <Label>{isEdit ? "Nueva contraseña (opcional)" : "Contraseña temporal"}</Label>
          <div className="flex gap-2">
            <Input
              value={f.password}
              placeholder={isEdit ? "Dejar en blanco para no cambiar" : "Generada automáticamente"}
              className="font-mono"
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setF({ ...f, password: generatePassword() })} title="Regenerar">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {!isEdit && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Se mostrará una sola vez al terminar. Copiala y envíala al delegado.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Rol</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as Role, team_id: v === "delegado" ? f.team_id : "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Equipo asignado</Label>
            <Select
              value={f.team_id || "none"}
              disabled={f.role !== "delegado"}
              onValueChange={(v) => setF({ ...f, team_id: v === "none" ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="Sin equipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin equipo</SelectItem>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <div className="text-sm font-semibold">Usuario activo</div>
            <div className="text-xs text-muted-foreground">Un usuario inactivo no puede iniciar sesión con permisos.</div>
          </div>
          <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={saving} onClick={async () => {
          if (!f.full_name.trim()) return toast.error("Nombre requerido");
          if (!isEdit && (!f.email.trim() || f.password.length < 8)) {
            return toast.error("Correo y contraseña (mín. 8) son requeridos");
          }
          if (f.role === "delegado" && !isEdit && !f.team_id) {
            return toast.error("Asigná un equipo al delegado");
          }
          setSaving(true);
          try {
            if (isEdit) {
              await updateUser({
                data: {
                  user_id: user.id,
                  full_name: f.full_name,
                  role: f.role,
                  team_id: f.role === "delegado" ? (f.team_id || null) : null,
                  active: f.active,
                  new_password: f.password || undefined,
                },
              });
              toast.success("Usuario actualizado");
              onSaved(f.password ? { email: user.email, password: f.password } : undefined);
            } else {
              await createUser({
                data: {
                  email: f.email.trim(),
                  password: f.password,
                  full_name: f.full_name.trim(),
                  role: f.role,
                  team_id: f.role === "delegado" ? (f.team_id || null) : null,
                  active: f.active,
                },
              });
              toast.success("Usuario creado");
              onSaved({ email: f.email.trim(), password: f.password });
            }
          } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
        }}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
