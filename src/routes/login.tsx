import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "signin" | "forgot";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError("E-mail ou senha inválidos.");
      return;
    }
    navigate({ to: "/" });
  }

  async function handleForgot(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError("Não foi possível enviar o e-mail de redefinição. Verifique o endereço e tente novamente.");
      return;
    }
    setInfo("Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Verifique sua caixa de entrada.");
  }

  const isForgot = mode === "forgot";

  return (
    <div className="min-h-screen bg-background paper-texture flex items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            PNAB · Caxias do Sul
          </div>
          <CardTitle className="font-serif text-2xl">
            {isForgot ? "Redefinir senha" : "Avaliação Assistida"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {isForgot
              ? "Informe seu e-mail para receber o link de redefinição."
              : "Edital 119/2026 · Ciclo 2 · Acesso restrito"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={isForgot ? handleForgot : handleSignIn} className="space-y-4">
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
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!isForgot && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setInfo(null);
                    }}
                  >
                    Esqueci a senha
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? isForgot
                  ? "Enviando…"
                  : "Entrando…"
                : isForgot
                  ? "Enviar link de redefinição"
                  : "Entrar"}
            </Button>
            {isForgot && (
              <button
                type="button"
                className="w-full text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
              >
                Voltar para o login
              </button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
