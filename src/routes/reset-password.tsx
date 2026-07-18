import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash and emits a PASSWORD_RECOVERY event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also check if a session already exists (link just consumed).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Não foi possível atualizar a senha. O link pode ter expirado — solicite um novo.");
      return;
    }

    setInfo("Senha atualizada com sucesso. Redirecionando…");
    setTimeout(() => navigate({ to: "/" }), 1200);
  }

  return (
    <div className="min-h-screen bg-background paper-texture flex items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            PNAB · Caxias do Sul
          </div>
          <CardTitle className="font-serif text-2xl">Definir nova senha</CardTitle>
          <p className="text-xs text-muted-foreground">
            Escolha uma nova senha para acessar a plataforma.
          </p>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-xs text-muted-foreground">
              Abra este link a partir do e-mail de redefinição enviado pelo sistema.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert className="border-destructive/40 bg-destructive/5">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}
              {info && (
                <Alert className="border-border bg-muted/40">
                  <AlertDescription className="text-xs">{info}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
