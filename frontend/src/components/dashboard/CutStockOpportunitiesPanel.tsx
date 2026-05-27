import Link from "next/link";
import { ArrowRight, Scissors } from "lucide-react";
import type { StockOpportunity } from "@/components/dashboard/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";

export function CutStockOpportunitiesPanel({
  opportunities,
  loading
}: {
  opportunities: StockOpportunity[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Estoque livre
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">Peças disponíveis para atendimento</h2>
            <p className="mt-2 text-sm text-muted">
              Saldo livre que pode atender OS pendentes por produto, tamanho e cor.
            </p>
          </div>
          <Link
            href="/cutting"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink shadow-insetline transition hover:bg-accent-soft/70 focus:focus-ring"
          >
            Ir para Corte
            <ArrowRight size={15} />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <EmptyState
            icon={<Scissors size={20} />}
            title="Sem peças cortadas livres"
            description="O saldo livre de peças cortadas aparecerá aqui quando estiver disponível."
            className="min-h-36"
          />
        ) : (
          <div className="space-y-3">
            {opportunities.map((opportunity) => (
              <div key={opportunity.key} className="rounded-md border border-line bg-[#FCFAF6] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-ink">{opportunity.product}</p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Tam. {opportunity.size} / {opportunity.color}
                    </p>
                  </div>
                  <p className="text-right text-xl font-black text-ink">
                    {formatNumber(opportunity.quantity)}
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      livres
                    </span>
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={opportunity.indicationTone}>{opportunity.indication}</Badge>
                  <span className="text-xs font-semibold text-muted">
                    {opportunity.compatibleOrders} OS compatível(is)
                  </span>
                  {opportunity.priority ? (
                    <Badge tone={opportunity.priority === "critical" ? "danger" : opportunity.priority === "urgent" ? "warning" : "neutral"}>
                      {opportunity.priority === "critical" ? "Crítica" : opportunity.priority === "urgent" ? "Urgente" : "Normal"}
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
