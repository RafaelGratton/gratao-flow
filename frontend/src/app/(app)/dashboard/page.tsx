"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AttentionPanel } from "@/components/dashboard/AttentionPanel";
import { CutStockOpportunitiesPanel } from "@/components/dashboard/CutStockOpportunitiesPanel";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { DeliveryAttentionPanel } from "@/components/dashboard/DeliveryAttentionPanel";
import { buildDashboardModel } from "@/components/dashboard/helpers";
import { OperationalSummaryCards } from "@/components/dashboard/OperationalSummaryCards";
import { PausedProductionPanel } from "@/components/dashboard/PausedProductionPanel";
import { ProductionStagesPanel } from "@/components/dashboard/ProductionStagesPanel";
import type { DashboardSource } from "@/components/dashboard/types";
import type { DeliveryList } from "@/components/deliveries/types";
import type { OrderDetails, OrderSummary } from "@/components/orders/types";
import type { StockItem } from "@/components/stock/types";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const [source, setSource] = useState<DashboardSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaries, stockItems, deliveries] = await Promise.all([
        api.get<OrderSummary[]>("/orders"),
        api.get<StockItem[]>("/stock/items"),
        api.get<DeliveryList>("/deliveries")
      ]);
      const activeSummaries = summaries.filter(
        (order) => !["cancelled", "delivered"].includes(order.production_status)
      );
      const activeOrders = await Promise.all(
        activeSummaries.map((order) => api.get<OrderDetails>(`/orders/${order.id}`))
      );
      setSource({ activeOrders, stockItems, deliveries });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar o dashboard operacional."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const model = useMemo(() => (source ? buildDashboardModel(source) : null), [source]);
  const waitingForData = !model;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Operação diária
            </p>
            <h1 className="mt-1 text-3xl font-black text-ink">Dashboard</h1>
            <p className="mt-2 text-sm font-medium text-muted">Atenções e andamento da operação</p>
          </div>
          <Button type="button" variant="secondary" isLoading={loading} onClick={() => void loadDashboard()}>
            <RefreshCw size={16} />
            Atualizar
          </Button>
        </div>
        <DashboardQuickActions />
      </header>

      {error ? (
        <div className="rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      <OperationalSummaryCards summary={model?.summary ?? null} loading={waitingForData} />

      <AttentionPanel alerts={model?.alerts ?? []} loading={waitingForData} />

      <section className="grid gap-6 xl:grid-cols-2">
        <ProductionStagesPanel stages={model?.stages ?? []} loading={waitingForData} />
        <CutStockOpportunitiesPanel
          opportunities={model?.opportunities ?? []}
          loading={waitingForData}
        />
        <PausedProductionPanel orders={model?.pausedOrders ?? []} loading={waitingForData} />
        <DeliveryAttentionPanel
          deliveries={model?.deliveries ?? null}
          priorities={model?.deliveryPriorities ?? []}
          loading={waitingForData}
        />
      </section>
    </div>
  );
}
