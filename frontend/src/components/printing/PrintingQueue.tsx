"use client";

import { CheckCircle2, Clock3, Layers3, PlayCircle, Stamp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { hasPrintingService, productionLabels, productionTone } from "@/components/orders/status";
import type { OrderDetails, OrderSummary } from "@/components/orders/types";
import { PrintActionModal } from "@/components/printing/PrintActionModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";

type QueueStage = "waiting_cut" | "ready" | "active" | "done";

function printStage(order: OrderDetails): QueueStage {
  if (order.quantity_cut === 0) return "waiting_cut";
  if (order.quantity_printed >= order.quantity_cut) return "done";
  if (order.quantity_printed > 0 || order.production_status === "in_print") return "active";
  return "ready";
}

function printServiceLabel(order: OrderDetails) {
  const service = order.services.find((item) => item.service.type === "serigrafia");
  if (service?.service.name) return service.service.name;
  return order.print_type === "front_back" ? "Frente e costas" : "Frente";
}

export function PrintingQueue() {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaries = await api.get<OrderSummary[]>("/orders");
      const openSummaries = summaries.filter(
        (order) => !["cancelled", "delivered"].includes(order.production_status)
      );
      const details = await Promise.all(
        openSummaries.map((order) => api.get<OrderDetails>(`/orders/${order.id}`))
      );
      setOrders(
        details.filter(
          (order) =>
            hasPrintingService(order.services) &&
            (order.quantity_cut === 0 || order.quantity_printed < order.quantity_cut)
        )
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar a fila de serigrafia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const summary = useMemo(() => {
    const values = { waiting_cut: 0, ready: 0, active: 0, done: 0 };
    for (const order of orders) {
      values[printStage(order)] += 1;
    }
    return values;
  }, [orders]);

  function handleUpdated(updated: OrderDetails) {
    setOrders((current) => {
      const next = current.map((order) => (order.id === updated.id ? updated : order));
      return next.filter(
        (order) =>
          hasPrintingService(order.services) &&
          !["cancelled", "delivered"].includes(order.production_status) &&
          (order.quantity_cut === 0 || order.quantity_printed < order.quantity_cut)
      );
    });
    setSuccess(`DTF registrado na OS #${updated.id}.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Painel operacional de aplicacao DTF
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">Serigrafia</h1>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadOrders()} disabled={loading}>
          Atualizar fila
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Aguardando corte", value: summary.waiting_cut, icon: Clock3 },
          { label: "Prontas para DTF", value: summary.ready, icon: Stamp },
          { label: "Em andamento", value: summary.active, icon: PlayCircle },
          { label: "Concluidas", value: summary.done, icon: CheckCircle2 }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-accent-soft text-accent-dark">
                <item.icon size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{item.label}</p>
                <p className="mt-1 text-2xl font-black text-ink">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="bg-white/70">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Fila de producao</p>
            <h2 className="mt-1 text-xl font-black text-ink">OS com serigrafia</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Layers3 size={20} />}
                title="Nenhuma OS aguardando DTF"
                description="Quando uma OS com serviço de serigrafia entrar em corte ou ficar pronta, ela aparece nesta fila."
              />
            </div>
          ) : (
            <div className="divide-y divide-line/70">
              {orders.map((order) => {
                const stage = printStage(order);
                const remaining = Math.max(order.quantity_cut - order.quantity_printed, 0);
                return (
                  <div key={order.id} className="grid gap-4 p-5 transition hover:bg-accent-soft/25 xl:grid-cols-[1.2fr_1fr_1fr_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black text-ink">OS #{order.id}</span>
                        {stage === "waiting_cut" ? <Badge tone="warning">Aguardando corte</Badge> : null}
                        {stage === "active" ? <Badge tone="accent">Em andamento</Badge> : null}
                        {stage === "done" ? <Badge tone="success">Concluida</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-muted">{order.client.name}</p>
                      <p className="mt-3 text-sm text-muted">
                        <span className="font-bold text-ink">{order.product.name}</span> / {order.size.label} / {order.color}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Cortada</p>
                        <p className="mt-1 font-black text-ink">{order.quantity_cut}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">DTF</p>
                        <p className="mt-1 font-black text-ink">{order.quantity_printed}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Restante</p>
                        <p className="mt-1 font-black text-ink">{remaining}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-ink">{printServiceLabel(order)}</p>
                      <StatusBadge label={productionLabels[order.production_status]} status={productionTone(order.production_status)} />
                    </div>
                    <Button
                      type="button"
                      disabled={order.quantity_cut === 0 || stage === "done"}
                      onClick={() => setSelectedOrder(order)}
                    >
                      Registrar DTF
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PrintActionModal
        open={Boolean(selectedOrder)}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
