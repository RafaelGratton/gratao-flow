"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FinancePaymentModal } from "@/components/finance/FinancePaymentModal";
import { FinanceSummaryCards } from "@/components/finance/FinanceSummaryCards";
import { PayoutsTable } from "@/components/finance/PayoutsTable";
import { ReceivablesTable } from "@/components/finance/ReceivablesTable";
import type { FinanceSummary, PayoutRow } from "@/components/finance/types";
import type { OrderDetails, OrderSummary } from "@/components/orders/types";
import { api } from "@/lib/api";

function money(value: string | number) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function FinancePage() {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<OrderDetails | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaries = await api.get<OrderSummary[]>("/orders");
      const details = await Promise.all(summaries.map((order) => api.get<OrderDetails>(`/orders/${order.id}`)));
      setOrders(details);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar o financeiro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function replaceOrder(updated: OrderDetails) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
  }

  const payoutRows = useMemo<PayoutRow[]>(
    () =>
      orders.flatMap((order) =>
        order.outsourcings.map((outsourcing) => ({
          order,
          outsourcing
        }))
      ),
    [orders]
  );

  const summary = useMemo<FinanceSummary>(
    () => ({
      totalInvoiced: orders.reduce((total, order) => total + money(order.total_amount), 0),
      totalReceived: orders.reduce((total, order) => total + money(order.amount_paid), 0),
      totalPending: orders.reduce((total, order) => total + money(order.amount_due), 0),
      payoutPending: payoutRows
        .filter((row) => row.outsourcing.payout_status === "pending")
        .reduce((total, row) => total + money(row.outsourcing.outsourcer_total), 0),
      outsourcingProfit: payoutRows.reduce((total, row) => total + money(row.outsourcing.profit_total), 0)
    }),
    [orders, payoutRows]
  );

  function handlePaymentUpdated(updated: OrderDetails) {
    replaceOrder(updated);
    setFeedback("Pagamento registrado com sucesso.");
  }

  function handlePayoutUpdated(updated: OrderDetails) {
    replaceOrder(updated);
    setFeedback("Repasse marcado como pago.");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Gratão Flow</p>
        <h1 className="mt-1 text-3xl font-black text-ink">Financeiro</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Recebimentos, pendencias e repasses</p>
      </div>

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

      <FinanceSummaryCards summary={summary} />
      <ReceivablesTable orders={orders} loading={loading} onAddPayment={setPaymentOrder} />
      <PayoutsTable rows={payoutRows} loading={loading} onPaid={handlePayoutUpdated} onError={setError} />
      <FinancePaymentModal
        order={paymentOrder}
        onClose={() => setPaymentOrder(null)}
        onUpdated={handlePaymentUpdated}
      />
    </div>
  );
}
