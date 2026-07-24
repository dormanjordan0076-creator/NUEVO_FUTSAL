import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Error("Solo administradores");
  }
}

/** Lista todos los usuarios con su perfil, rol y equipo asignado. */
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, { data: teams }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name, phone, active, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("teams").select("id, name, delegate_user_id"),
    ]);

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    });
    const teamByDelegate = new Map<string, { id: string; name: string }>();
    (teams ?? []).forEach((t: any) => {
      if (t.delegate_user_id) teamByDelegate.set(t.delegate_user_id, { id: t.id, name: t.name });
    });

    return (profiles ?? []).map((p: any) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
      team: teamByDelegate.get(p.id) ?? null,
    }));
  });

/** Crea un usuario (email + password) y le asigna un rol. Solo admin. */
export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(8).max(72),
      full_name: z.string().trim().min(2).max(120),
      role: z.enum(["admin", "delegado", "arbitro"]),
      team_id: z.string().uuid().nullable().optional(),
      active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "No se pudo crear el usuario");
    const uid = created.user.id;

    // Perfil (upsert por si el trigger lo creó)
    await supabaseAdmin.from("profiles").upsert({
      id: uid, email: data.email, full_name: data.full_name, active: data.active,
    });

    // Reemplazar roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (rErr) throw new Error(rErr.message);

    // Asignar equipo (solo delegado)
    if (data.role === "delegado" && data.team_id) {
      await supabaseAdmin.from("teams").update({ delegate_user_id: uid }).eq("id", data.team_id);
    }
    return { id: uid };
  });

/** Actualiza rol, equipo y estado de un usuario. */
export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      user_id: z.string().uuid(),
      full_name: z.string().trim().min(2).max(120).optional(),
      role: z.enum(["admin", "delegado", "arbitro"]).optional(),
      team_id: z.string().uuid().nullable().optional(),
      active: z.boolean().optional(),
      new_password: z.string().min(8).max(72).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = data.user_id;

    if (data.full_name !== undefined || data.active !== undefined) {
      await supabaseAdmin.from("profiles").update({
        ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      }).eq("id", uid);
    }

    if (data.new_password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { password: data.new_password });
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
      // Si deja de ser delegado, desvincular equipos
      if (data.role !== "delegado") {
        await supabaseAdmin.from("teams").update({ delegate_user_id: null }).eq("delegate_user_id", uid);
      }
    }

    if (data.team_id !== undefined) {
      // Limpiar cualquier equipo previo y asignar el nuevo
      await supabaseAdmin.from("teams").update({ delegate_user_id: null }).eq("delegate_user_id", uid);
      if (data.team_id) {
        await supabaseAdmin.from("teams").update({ delegate_user_id: uid }).eq("id", data.team_id);
      }
    }

    return { ok: true };
  });

/** Elimina definitivamente un usuario. */
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) throw new Error("No podés eliminar tu propio usuario");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("teams").update({ delegate_user_id: null }).eq("delegate_user_id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
