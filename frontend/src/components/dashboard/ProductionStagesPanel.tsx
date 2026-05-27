import Link from "next/link";
import { ArrowRight, Factory } from "lucide-react";
import type { DashboardStage } from "@/components/dashboard/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";

export function ProductionStagesPanel({
  stages,
  loading
}: {
  stages: DashboardStage[];
  loading: boolean;
}) {
  const hasProduction = stages.some((stage) => stage.orderCount > 0);

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
          Fila por etapa
        </p>
        <h2 className="mt-1 text-xl font-black text-ink">Produção atual</h2>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : !hasProduction ? (
          <EmptyState
            icon={<Factory size={20} />}
            title="Nenhuma OS ativa em produção"
            description="As filas por etapa aparecem aqui quando houver saldo operacional em andamento."
            className="min-h-36"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {stages.map((stage) => (
              <Link
                href={stage.href}
                key={stage.key}
                className="rounded-md border border-line bg-[#FCFAF6] p-3 transition hover:border-accent/40 hover:bg-accent-soft/30 focus:focus-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-black text-ink">{stage.label}</p>
                  <ArrowRight className="shrink-0 text-muted" size={15} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-2xl font-black text-ink">{formatNumber(stage.orderCount)}</p>
                    <p className="text-xs font-semibold text-muted">OS</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-ink">{formatNumber(stage.pieces)}</p>
                    <p className="text-[11px] font-semibold text-muted">{stage.pieceLabel}</p>
                  </div>
                </div>
                {stage.priorityOrders > 0 ? (
                  <Badge tone="warning" className="mt-3">
                    {stage.priorityOrders} urgente(s) / crítica(s)
                  </Badge>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
