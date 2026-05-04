"use client";

import { useEffect, useState } from "react";
import { OrderTable } from "@/components/orders/OrderTable";
import type { OrderSummary } from "@/components/orders/types";
import { api } from "@/lib/api";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<OrderSummary[]>("/orders");
        if (active) {
          setOrders(data);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error ? requestError.message : "Nao foi possivel carregar as OS."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      active = false;
    };
  }, []);

  async function handleCancel(order: OrderSummary) {
    const confirmed = window.confirm(
      "Essa ação remove/cancela a ordem da operação. Deseja continuar?"
    );
    if (!confirmed) return;

    setError(null);
    setFeedback(null);
    try {
      await api.delete(`/orders/${order.id}`);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setFeedback(`OS #${order.id} cancelada com sucesso.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel cancelar a OS."
      );
    }
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <div className="rounded-md border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}
      <OrderTable orders={orders} loading={loading} onCancel={handleCancel} />
    </div>
  );
}
