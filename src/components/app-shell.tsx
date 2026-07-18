import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FolderSync,
  Users,
  FileText,
  ShieldCheck,
  History,
  BookMarked,
  LogOut,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/fonte-documental", label: "Fonte documental", icon: FolderSync },
  { to: "/proponentes", label: "Proponentes", icon: Users, badge: "8" },
  { to: "/mudancas", label: "Mudanças", icon: History, badge: "5" },
  { to: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { to: "/documentos-normativos", label: "Documentos normativos", icon: BookMarked },
] as const;

export function AppShell({ children, title, subtitle, actions }: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background paper-texture flex">
      <aside className="w-72 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="px-6 pt-7 pb-5 border-b border-sidebar-border">
          <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
            PNAB · Caxias do Sul
          </div>
          <h1 className="font-serif text-xl leading-tight mt-1.5 text-sidebar-foreground">
            Avaliação Assistida
          </h1>
          <div className="text-xs text-sidebar-foreground/70 mt-1">
            Edital 119/2026 · Ciclo 2
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, badge }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sidebar-primary/20 text-sidebar-primary">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-serif text-sm">
              VR
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Viviane da Rocha Palma</div>
              <div className="text-[11px] text-sidebar-foreground/60">Avaliadora · Contrato 2026/531</div>
            </div>
            <button className="text-sidebar-foreground/60 hover:text-sidebar-foreground" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="px-8 py-5 flex items-center gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl text-foreground leading-tight">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar proponente, arquivo, evidência…" className="pl-9 bg-card" />
            </div>
            {actions}
          </div>
        </header>
        <main className="flex-1 px-8 py-8">{children}</main>
        <footer className="px-8 py-4 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
          <span>PNAB · Caxias · Edital 119/2026 · Avaliação individual</span>
          <span className="font-mono">Baseline v3 · sync 14/03/2026 12:04</span>
        </footer>
      </div>
    </div>
  );
}

export function StatusBadge({ tone, children }: {
  tone: "neutral" | "info" | "warning" | "success" | "danger";
  children: ReactNode;
}) {
  const toneClass = {
    neutral: "bg-muted text-muted-foreground border-border",
    info: "bg-info/10 text-info border-info/30",
    warning: "bg-warning/15 text-warning-foreground border-warning/40",
    success: "bg-success/10 text-success border-success/30",
    danger: "bg-destructive/10 text-destructive border-destructive/30",
  }[tone];
  return (
    <Badge variant="outline" className={cn("font-normal text-[11px]", toneClass)}>
      {children}
    </Badge>
  );
}
