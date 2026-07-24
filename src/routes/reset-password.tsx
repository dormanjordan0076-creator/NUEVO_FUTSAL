import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nueva contraseña · Integración Futsal" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase pone la sesión de recovery automáticamente al abrir el link
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-pitch text-pitch-foreground shadow-elevated">
        <KeyRound className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-center text-2xl font-black uppercase tracking-tight">Nueva contraseña</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Elegí una contraseña segura para tu cuenta.
      </p>
      <Card className="mt-6 w-full">
        <CardContent className="p-5">
          {!ready ? (
            <p className="text-center text-sm text-muted-foreground">
              Abrí el enlace desde el correo que te enviamos para poder cambiar tu contraseña.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (ev) => {
                ev.preventDefault();
                if (pass.length < 8) return toast.error("Mínimo 8 caracteres");
                if (pass !== pass2) return toast.error("Las contraseñas no coinciden");
                setLoading(true);
                const { error } = await supabase.auth.updateUser({ password: pass });
                setLoading(false);
                if (error) return toast.error(error.message);
                toast.success("Contraseña actualizada");
                nav({ to: "/" });
              }}
            >
              <div>
                <Label>Nueva contraseña</Label>
                <Input type="password" required minLength={8} value={pass} onChange={(e) => setPass(e.target.value)} />
              </div>
              <div>
                <Label>Repetir contraseña</Label>
                <Input type="password" required minLength={8} value={pass2} onChange={(e) => setPass2(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando..." : "Cambiar contraseña"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
