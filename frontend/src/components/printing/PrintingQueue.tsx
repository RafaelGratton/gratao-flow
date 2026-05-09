"use client";

import { CheckCircle2, Clock3, Layers3, PlayCircle, Stamp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { productionFlowLabels } from "@/components/orders/status";
import type { OrderDetails, OrderItem, OrderSummary } from "@/components/orders/types";
import { PrintActionModal } from "@/components/printing/PrintActionModal";
import { getItemPrintingService, itemStageDone } from "@/components/production/helpers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";

type QueueStage = "waiting_cut" | "ready" | "active" | "done";

type PrintRow = {
  order: OrderDetails;
  item: OrderItem;
  itemNumber: number;
};

function printStage(item: OrderItem): QueueStage {
  if (item.quantity_cut === 0 || !itemStageDone(item, "cut")) return "waiting_cut";
  if (item.quantity_printed >= item.quantity_requested) return "done";
  if (item.quantity_printed > 0) return "active";
  return "ready";
}

function printServiceLabel(item: OrderItem) {
  const service = getItemPrintingService(item);
  return service?.service.name ?? "Serigrafia";
}

export function PrintingQueue() {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<PrintRow | null>(null);

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
      setOrders(details);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar a fila de serigrafia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const rows = useMemo(
    () =>
      orders.flatMap((order) =>
        order.items
          .map((item, index) => ({ order, item, itemNumber: index + 1 }))
          .filter(
            (row) =>
              row.item.production_flow === "deliver_after_print" &&
              row.item.quantity_printed < row.item.quantity_requested
          )
      ),
    [orders]
  );

  const summary = useMemo(() => {
    const values = { waiting_cut: 0, ready: 0, active: 0, done: 0 };
    for (const row of rows) {
      values[printStage(row.item)] += 1;
    }
    return values;
  }, [rows]);

  function handleUpdated(updated: OrderDetails) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess(`DTF registrado na OS #${updated.id}.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Painel operacional de aplicacao DTF por item
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
            <h2 className="mt-1 text-xl font-black text-ink">Itens com serigrafia</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Layers3 size={20} />}
                title="Nenhum item aguardando DTF"
                description="Itens com fluxo de corte + serigrafia aparecem nesta fila."
              />
            </div>
          ) : (
            <div className="divide-y divide-line/70">
              {rows.map((row) => {
                const stage = printStage(row.item);
                const remaining = Math.max(row.item.quantity_requested - row.item.quantity_printed, 0);
                return (
                  <div key={`${row.order.id}-${row.item.id}`} className="grid gap-4 p-5 transition hover:bg-accent-soft/25 xl:grid-cols-[1.2fr_1fr_1fr_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black text-ink">OS #{row.order.id}</span>
                        <Badge tone="accent">Item {row.itemNumber}</Badge>
                        {stage === "waiting_cut" ? <Badge tone="warning">Aguardando corte</Badge> : null}
                        {stage === "active" ? <Badge tone="accent">Em andamento</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-muted">{row.order.client.name}</p>
                      <p className="mt-3 text-sm text-muted">
                        <span className="font-bold text-ink">{row.item.product.name}</span> / {row.item.size.label} / {row.item.color}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3">
                      <Metric label="Cortada" value={row.item.quantity_cut} />
                      <Metric label="DTF" value={row.item.quantity_printed} />
                      <Metric label="Restante" value={remaining} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-ink">{printServiceLabel(row.item)}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-dark">
                        {productionFlowLabels[row.item.production_flow]}
                      </p>
                    </div>
                    <Button
                      type="button"
                      disabled={stage !== "ready" && stage !== "active"}
                      onClick={() => setSelected(row)}
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
        open={Boolean(selected)}
        order={selected?.order ?? null}
        item={selected?.item ?? null}
        onClose={() => setSelected(null)}
        onUpdated={handleUpdated}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 font-black text-ink">{value}</p>
    </div>
  );
}
