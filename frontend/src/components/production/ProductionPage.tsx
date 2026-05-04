"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { productionLabels } from "@/components/orders/status";
import type { OrderDetails, OrderSummary } from "@/components/orders/types";
import { hasPrinting } from "@/components/production/helpers";
import { ProductionCutModal } from "@/components/production/ProductionCutModal";
import { ProductionOrderCard } from "@/components/production/ProductionOrderCard";
import { ProductionSection } from "@/components/production/ProductionSection";
import { ProductionSewModal } from "@/components/production/ProductionSewModal";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

export function ProductionPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cutOrder, setCutOrder] = useState<OrderDetails | null>(null);
  const [sewOrder, setSewOrder] = useState<OrderDetails | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaries = await api.get<OrderSummary[]>("/orders");
      const openSummaries = summaries.filter((order) => order.production_status !== "cancelled");
      const details = await Promise.all(
        openSummaries.map((order) => api.get<OrderDetails>(`/orders/${order.id}`))
      );
      setOrders(details);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar a producao.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const queues = useMemo(() => {
    const cut = orders.filter((order) => order.production_status === "created");
    const printing = orders.filter(
      (order) => order.production_status === "cut_done" && hasPrinting(order)
    );
    const sewing = orders.filter((order) => {
      if (hasPrinting(order)) return order.production_status === "print_done";
      return order.production_status === "cut_done";
    });
    const outsourcing = orders.filter((order) =>
      ["cut_done", "print_done"].includes(order.production_status)
    );
    const finishing = orders.filter((order) => order.production_status === "sewing_done");
    return { cut, printing, sewing, outsourcing, finishing };
  }, [orders]);

  function replaceOrder(updated: OrderDetails, message: string) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess(message);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Controle operacional da esteira produtiva
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">Produção</h1>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadOrders()} disabled={loading}>
          <RefreshCw size={16} />
          Atualizar
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

      <ProductionSection
        title="Fila de corte"
        description="Ordens criadas, prontas para registrar quantidade cortada."
        count={queues.cut.length}
        loading={loading}
      >
        {queues.cut.map((order) => (
          <ProductionOrderCard key={order.id} order={order} stage="cut" onCut={setCutOrder} />
        ))}
      </ProductionSection>

      <ProductionSection
        title="Fila para serigrafia"
        description="Ordens com corte concluído e serviço de serigrafia."
        count={queues.printing.length}
        loading={loading}
      >
        {queues.printing.map((order) => (
          <ProductionOrderCard
            key={order.id}
            order={order}
            stage="printing"
            onGoPrinting={() => router.push("/printing")}
          />
        ))}
      </ProductionSection>

      <ProductionSection
        title="Fila de confecção"
        description="OS liberadas para costura conforme a dependência de serigrafia."
        count={queues.sewing.length}
        loading={loading}
      >
        {queues.sewing.map((order) => (
          <ProductionOrderCard
            key={order.id}
            order={order}
            stage="sewing"
            previousStatus={productionLabels[order.production_status]}
            onSew={setSewOrder}
          />
        ))}
      </ProductionSection>

      <ProductionSection
        title="Terceirização"
        description="Atalho para ordens com corte concluído ou serigrafia concluída."
        count={queues.outsourcing.length}
        loading={loading}
      >
        {queues.outsourcing.map((order) => (
          <ProductionOrderCard
            key={order.id}
            order={order}
            stage="outsourcing"
            onGoOutsourcing={() => router.push("/outsourcing")}
          />
        ))}
      </ProductionSection>

      <ProductionSection
        title="Finalização"
        description="Ordens com confecção concluída, aguardando entrega ou finalização."
        count={queues.finishing.length}
        loading={loading}
      >
        {queues.finishing.map((order) => (
          <ProductionOrderCard key={order.id} order={order} stage="finishing" />
        ))}
      </ProductionSection>

      <ProductionCutModal
        open={Boolean(cutOrder)}
        order={cutOrder}
        onClose={() => setCutOrder(null)}
        onUpdated={(order) => replaceOrder(order, `Corte registrado na OS #${order.id}.`)}
      />
      <ProductionSewModal
        open={Boolean(sewOrder)}
        order={sewOrder}
        onClose={() => setSewOrder(null)}
        onUpdated={(order) => replaceOrder(order, `Confecção registrada na OS #${order.id}.`)}
      />
    </div>
  );
}
