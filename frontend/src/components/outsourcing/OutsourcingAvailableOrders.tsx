"use client";

import { Send } from "lucide-react";
import type { OrderDetails, OrderItem } from "@/components/orders/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export type AvailableOutsourcingItem = {
  order: OrderDetails;
  item: OrderItem;
  availableQuantity: number;
};

type Props = {
  items: AvailableOutsourcingItem[];
  loading: boolean;
  onSend: (target: AvailableOutsourcingItem) => void;
};

function stepsDone(item: OrderItem) {
  return [
    item.quantity_cut >= item.quantity_requested ? "Corte" : null,
    item.services.some((service) => service.service.type === "serigrafia") &&
    item.quantity_printed >= item.quantity_requested
      ? "Serigrafia"
      : null
  ].filter(Boolean);
}

export function OutsourcingAvailableOrders({ items, loading, onSend }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Disponiveis</p>
          <h2 className="mt-1 text-xl font-black text-ink">Itens prontos para terceirizacao</h2>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Send size={20} />}
            title="Nenhum item disponivel"
            description="Itens terceirizados com corte concluido e serigrafia concluida, quando houver, aparecem aqui para envio."
          />
        ) : (
          <div className="grid gap-3">
            {items.map((target) => {
              const doneSteps = stepsDone(target.item);
              return (
                <div key={`${target.order.id}-${target.item.id}`} className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-insetline lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-black text-ink">OS #{target.order.id}</span>
                      {target.availableQuantity <= 0 ? <Badge tone="warning">Sem saldo</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted">{target.order.client.name}</p>
                    <p className="mt-3 text-sm text-muted">
                      <span className="font-bold text-ink">{target.item.product.name}</span> / {target.item.size.label} / {target.item.color}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Quantidade disponivel</p>
                      <p className="mt-1 text-xl font-black text-ink">{target.availableQuantity}</p>
                    </div>
                    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Etapas concluidas</p>
                      <p className="mt-1 text-sm font-black text-ink">{doneSteps.join(" + ")}</p>
                    </div>
                  </div>
                  <Button type="button" disabled={target.availableQuantity <= 0} onClick={() => onSend(target)}>Enviar</Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
