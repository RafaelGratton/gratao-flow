"use client";

import { RefreshCcw } from "lucide-react";
import type { OrderDetails, OrderOutsourcing } from "@/components/orders/types";
import { PayoutButton } from "@/components/outsourcing/PayoutButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/format";

type OutsourcingItem = {
  order: OrderDetails;
  outsourcing: OrderOutsourcing;
};

type Props = {
  items: OutsourcingItem[];
  loading: boolean;
  onReturn: (order: OrderDetails, outsourcing: OrderOutsourcing) => void;
  onPaid: (order: OrderDetails) => void;
  onError: (message: string) => void;
};

const statusLabels: Record<string, string> = {
  sent: "Enviada",
  partially_returned: "Retorno parcial",
  returned: "Retornada",
  delivered_direct: "Direto ao cliente",
  cancelled: "Cancelada"
};

export function OutsourcingList({ items, loading, onReturn, onPaid, onError }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Operação e repasse</p>
          <h2 className="mt-1 text-xl font-black text-ink">Terceirizacoes em andamento</h2>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<RefreshCcw size={20} />}
            title="Nenhuma terceirização em andamento"
            description="Envios criados a partir das OS aparecem aqui com retorno, repasse e lucro."
          />
        ) : (
          <div className="grid gap-4">
            {items.map(({ order, outsourcing }) => {
              const item = order.items.find((orderItem) => orderItem.id === outsourcing.order_item_id);
              const canReturn =
                outsourcing.return_expected &&
                !["returned", "cancelled"].includes(outsourcing.status);
              return (
                <div key={`${order.id}-${outsourcing.id}`} className="rounded-lg border border-line bg-white p-4 shadow-insetline">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black text-ink">OS #{order.id}</span>
                        <Badge tone={outsourcing.status === "returned" || outsourcing.status === "delivered_direct" ? "success" : "accent"}>
                          {statusLabels[outsourcing.status] ?? outsourcing.status}
                        </Badge>
                        <Badge tone={outsourcing.payout_status === "paid" ? "success" : "warning"}>
                          Repasse {outsourcing.payout_status === "paid" ? "pago" : "pendente"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        {order.client.name} / {outsourcing.outsourcer?.name ?? "Sem terceirizado definido"}
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        <span className="font-bold text-ink">{item?.product.name ?? "Item nao identificado"}</span>
                        {" / "}
                        {item ? `${item.size.label} / ${item.color} / ` : ""}
                        enviado {outsourcing.quantity_sent} / retornado {outsourcing.quantity_returned}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-muted">Enviado em {formatDateTime(outsourcing.sent_at)}</p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Cobrado total</p>
                      <p className="mt-1 text-lg font-black text-ink">{formatCurrency(outsourcing.customer_total)}</p>
                    </div>
                    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Repasse total</p>
                      <p className="mt-1 text-lg font-black text-ink">{formatCurrency(outsourcing.outsourcer_total)}</p>
                    </div>
                    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Lucro</p>
                      <p className="mt-1 text-lg font-black text-success">{formatCurrency(outsourcing.profit_total)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" className="h-10 px-3" disabled={!canReturn} onClick={() => onReturn(order, outsourcing)}>
                      Registrar retorno
                    </Button>
                    <PayoutButton
                      orderId={order.id}
                      outsourcingId={outsourcing.id}
                      disabled={outsourcing.payout_status !== "pending"}
                      onPaid={onPaid}
                      onError={onError}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
