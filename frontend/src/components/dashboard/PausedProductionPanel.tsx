import Link from "next/link";
import { ArrowRight, CirclePause } from "lucide-react";
import type { PausedOrder } from "@/components/dashboard/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";

export function PausedProductionPanel({
  orders,
  loading
}: {
  orders: PausedOrder[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
          Acompanhamento
        </p>
        <h2 className="mt-1 text-xl font-black text-ink">Produção pausada</h2>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<CirclePause size={20} />}
            title="Nenhuma OS pausada"
            description="Não existem ordens ativas com a produção suspensa."
            className="min-h-36"
          />
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 4).map(({ order, allocatedPieces, items }) => (
              <article key={order.id} className="rounded-md border border-line bg-[#FCFAF6] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-ink">OS #{order.id}</p>
                      <Badge tone="warning">Pausada</Badge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted">{order.client.name}</p>
                  </div>
                  <p className="text-right text-xl font-black text-ink">
                    {formatNumber(allocatedPieces)}
                    <span className="block text-[11px] font-semibold text-muted">peças destinadas</span>
                  </p>
                </div>
                <p className="mt-2 text-xs font-semibold text-muted">
                  {items} {items === 1 ? "item" : "itens"} na OS
                </p>
                {allocatedPieces > 0 ? (
                  <p className="mt-2 text-sm text-warning">
                    Possui peças destinadas; verifique devolução para estoque.
                  </p>
                ) : null}
                <Link
                  href={`/orders/${order.id}`}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent-dark transition hover:text-ink focus:focus-ring"
                >
                  Abrir OS
                  <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
