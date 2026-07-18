import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL, STATUS_TONE, type ProponentStatus } from "@/lib/mock-data";
import { useCreateProponent, useDeleteProponent, useProponents } from "@/lib/queries/proponents";
import { Search, ShieldAlert, Trash2 } from "lucide-react";

export const Route = createFileRoute("/proponentes/")({
  component: ProponentesList,
});

function ProponentesList() {
  const { data: proponents, isLoading } = useProponents();
  const list = proponents ?? [];
  const [filter, setFilter] = useState("");

  const filtered = list.filter((p) =>
    `${p.nome_canonico} ${p.categoria ?? ""}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <AppShell
      title="Proponentes"
      subtitle="Dossiês atribuídos à avaliadora. Cada linha abre o dossiê completo com evidências, avaliação A–G e auditoria."
      actions={<NewProponentDialog />}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por nome, categoria…"
            className="pl-9 bg-card"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} proponentes</div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3 font-medium">Proponente</th>
              <th className="text-left px-4 py-3 font-medium">Categoria</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-center px-4 py-3 font-medium">Alerta</th>
              <th className="text-center px-4 py-3 font-medium">Pend.</th>
              <th className="text-right px-4 py-3 font-medium">Nota total</th>
              <th className="w-12 px-2 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum proponente cadastrado ainda.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const pendencias = p.criterion_scores.filter((c) => c.human_review_required).length;
              return (
                <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={"/proponentes/$id" as string}
                      params={{ id: p.id }}
                      className="font-medium hover:underline"
                    >
                      {p.nome_canonico}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.categoria ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.ciclo1_alerta ? (
                      <StatusBadge tone="danger">
                        <ShieldAlert className="w-3 h-3 mr-1 inline" />
                        {p.ciclo1_alerta}
                      </StatusBadge>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-mono tabular-nums">
                    {pendencias > 0 ? (
                      <span className="text-warning-foreground font-medium">{pendencias}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {p.evaluations ? (
                      <span
                        className={
                          p.evaluations.status === "aprovado_pela_avaliadora"
                            ? "text-success font-semibold"
                            : "text-warning-foreground"
                        }
                      >
                        {p.evaluations.individual_total}
                        <span className="text-[10px] text-muted-foreground">/110</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}

const STATUS_OPTIONS: ProponentStatus[] = [
  "nao_importado",
  "importado",
  "pendencia_administrativa",
];

function NewProponentDialog() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [status, setStatus] = useState<ProponentStatus>("nao_importado");
  const createProponent = useCreateProponent();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await createProponent.mutateAsync({ nome_canonico: nome, categoria, status });
    setOpen(false);
    setNome("");
    setCategoria("");
    setStatus("nao_importado");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Novo proponente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Cadastro manual de proponente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cadastro manual para testes da Fase 1, antes da importação automática do Drive (Fase 2).
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome canônico</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoria</Label>
            <Input
              id="categoria"
              placeholder="Trajetória Individual — Música"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status inicial</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProponentStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createProponent.isPending}>
              {createProponent.isPending ? "Salvando…" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
