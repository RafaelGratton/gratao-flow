"use client";

import { Send } from "lucide-react";
import { productionLabels, productionTone } from "@/components/orders/status";
import type { OrderDetails } from "@/components/orders/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Props = {
  orders: OrderDetails[];
  availableQuantity: (order: OrderDetails) => number;
  loading: boolean;
  onSend: (order: OrderDetails) => void;
};

export function OutsourcingAvailableOrders({ orders, availableQuantity, loading, onSend }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Disponiveis</p>
          <h2 className="mt-1 text-xl font-black text-ink">OS prontas para terceirização</h2>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Send size={20} />}
            title="Nenhuma OS disponivel"
            description="OS com corte concluído ou serigrafia concluída aparecem aqui para envio."
          />
        ) : (
          <div className="grid gap-3">
            {orders.map((order) => {
              const quantity = availableQuantity(order);
              return (
                <div key={order.id} className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-insetline lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-black text-ink">OS #{order.id}</span>
                      {quantity <= 0 ? <Badge tone="warning">Sem saldo</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted">{order.client.name}</p>
                    <p className="mt-3 text-sm text-muted">
                      <span className="font-bold text-ink">{order.product.name}</span> / {order.size.label} / {order.color}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Quantidade disponivel</p>
                      <p className="mt-1 text-xl font-black text-ink">{quantity}</p>
                    </div>
                    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Status</p>
                      <div className="mt-2">
                        <StatusBadge label={productionLabels[order.production_status]} status={productionTone(order.production_status)} />
                      </div>
                    </div>
                  </div>
                  <Button type="button" disabled={quantity <= 0} onClick={() => onSend(order)}>Enviar</Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
