import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Ingresar · Integración Futsal" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/campeonatos" }); });
  }, [nav]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-pitch text-pitch-foreground shadow-elevated">
        <Trophy className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-center text-2xl font-black uppercase tracking-tight">Acceso al sistema</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">Solo administradores y delegados autorizados</p>

      <Card className="mt-6 w-full">
        <CardContent className="p-5">
          {!showForgot ? (
            <form
              className="space-y-3"
              onSubmit={async (ev) => {
                ev.preventDefault();
                setLoading(true);
                const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
                setLoading(false);
                if (error) return toast.error(error.message);
                toast.success("Bienvenido");
                nav({ to: "/campeonatos" });
              }}
            >
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Contraseña</Label><Input type="password" required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</Button>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="block w-full text-center text-xs font-semibold text-muted-foreground hover:text-primary"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          ) : (
            <ForgotForm email={email} setEmail={setEmail} onBack={() => setShowForgot(false)} />
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Las credenciales las entrega el administrador del campeonato.
      </p>
      <Link to="/" className="mt-2 text-xs font-semibold text-primary hover:underline">← Volver a la página pública</Link>
    </div>
  );
}

function ForgotForm({ email, setEmail, onBack }: { email: string; setEmail: (s: string) => void; onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (ev) => {
        ev.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        setLoading(false);
        if (error) return toast.error(error.message);
        toast.success("Te enviamos un correo para restablecer tu contraseña");
        onBack();
      }}
    >
      <div>
        <Label>Email</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando..." : "Enviar enlace"}
      </Button>
      <button type="button" onClick={onBack} className="block w-full text-center text-xs font-semibold text-muted-foreground hover:text-primary">
        ← Volver a iniciar sesión
      </button>
    </form>
  );
}
