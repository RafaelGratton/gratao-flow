import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, PackageCheck, Truck } from "lucide-react";
import type { DeliveryList } from "@/components/deliveries/types";
import type { DeliveryPriority } from "@/components/dashboard/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";

export function DeliveryAttentionPanel({
  deliveries,
  priorities,
  loading
}: {
  deliveries: DeliveryList | null;
  priorities: DeliveryPriority[];
  loading: boolean;
}) {
  const metrics = [
    { label: "Prontos", value: deliveries?.summary.ready, icon: PackageCheck },
    { label: "Parciais", value: deliveries?.summary.partial, icon: Truck },
    { label: "Entregues hoje", value: deliveries?.summary.delivered_today, icon: CheckCircle2 },
    { label: "Pendentes", value: deliveries?.summary.pending, icon: Clock3 }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Retiradas e pendências
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">Entregas</h2>
          </div>
          <Link
            href="/deliveries"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink shadow-insetline transition hover:bg-accent-soft/70 focus:focus-ring"
          >
            Ver entregas
            <ArrowRight size={15} />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-md border border-line bg-[#FCFAF6] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
                <Icon size={15} className="text-accent-dark" />
              </div>
              <p className="mt-1 text-xl font-black text-ink">
                {loading || value === undefined ? "--" : formatNumber(value)}
              </p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : priorities.length === 0 ? (
          <EmptyState
            icon={<PackageCheck size={20} />}
            title="Sem prioridades de entrega"
            description="Não há itens pendentes ou alertas de retirada para acompanhar."
            className="min-h-32"
          />
        ) : (
          <div className="space-y-2">
            {priorities.map(({ item, reason, tone }) => (
              <div key={item.order_item_id} className="rounded-md border border-line bg-[#FCFAF6] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-ink">OS #{item.order_id} - {item.client.name}</p>
                  <Badge tone={tone}>{reason}</Badge>
                </div>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {item.product.name} / {item.size.label} / {item.color || "sem cor"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Disponivel: <span className="font-black text-ink">{item.quantity_available_to_deliver}</span>
                  {" | "}Restante: <span className="font-black text-ink">{item.quantity_remaining}</span>
                </p>
              </div>
            ))}
          </div>
        )}
        {!loading && deliveries && deliveries.summary.weak_proof > 0 ? (
          <p className="rounded-md border border-warning/20 bg-warning/10 p-3 text-sm font-semibold text-warning">
            {deliveries.summary.weak_proof} entrega(s) com comprovação de retirada incompleta.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
