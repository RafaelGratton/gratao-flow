"use client";

import { BadgeDollarSign, HandCoins, PackageCheck, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderOutsourcing, OrderSummary, Outsourcer } from "@/components/orders/types";
import { OutsourcingAvailableOrders } from "@/components/outsourcing/OutsourcingAvailableOrders";
import { OutsourcingCreateModal } from "@/components/outsourcing/OutsourcingCreateModal";
import { OutsourcingList } from "@/components/outsourcing/OutsourcingList";
import { OutsourcingReturnModal } from "@/components/outsourcing/OutsourcingReturnModal";
import { OutsourcerQuickCreateModal } from "@/components/outsourcing/OutsourcerQuickCreateModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type ReturnTarget = {
  order: OrderDetails;
  outsourcing: OrderOutsourcing;
};

function availableQuantity(order: OrderDetails) {
  const base = order.production_status === "cut_done" ? order.quantity_cut : order.quantity_printed;
  const alreadyOutsourced = order.outsourcings
    .filter((outsourcing) => outsourcing.status !== "cancelled")
    .reduce((total, outsourcing) => total + outsourcing.quantity_sent, 0);
  return Math.max(base - alreadyOutsourced, 0);
}

export function OutsourcingPanel() {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [outsourcers, setOutsourcers] = useState<Outsourcer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sendOrder, setSendOrder] = useState<OrderDetails | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<ReturnTarget | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaries, outsourcerList] = await Promise.all([
        api.get<OrderSummary[]>("/orders"),
        api.get<Outsourcer[]>("/outsourcers")
      ]);
      const relevantSummaries = summaries.filter((order) => order.production_status !== "cancelled");
      const details = await Promise.all(
        relevantSummaries.map((order) => api.get<OrderDetails>(`/orders/${order.id}`))
      );
      const detailsWithOutsourcings = await Promise.all(
        details.map(async (order) => ({
          ...order,
          outsourcings: await api.get<OrderOutsourcing[]>(`/orders/${order.id}/outsourcings`)
        }))
      );
      setOrders(detailsWithOutsourcings);
      setOutsourcers(outsourcerList.filter((outsourcer) => outsourcer.is_active));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar terceirizacoes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          ["cut_done", "print_done"].includes(order.production_status) &&
          !["delivered", "cancelled"].includes(order.production_status)
      ),
    [orders]
  );

  const outsourcingItems = useMemo(
    () =>
      orders
        .flatMap((order) =>
          order.outsourcings.map((outsourcing) => ({
            order,
            outsourcing
          }))
        )
        .sort((a, b) => new Date(b.outsourcing.sent_at).getTime() - new Date(a.outsourcing.sent_at).getTime()),
    [orders]
  );

  const financialSummary = useMemo(() => {
    return outsourcingItems.reduce(
      (totals, item) => ({
        customer: totals.customer + Number(item.outsourcing.customer_total),
        payout: totals.payout + Number(item.outsourcing.outsourcer_total),
        profit: totals.profit + Number(item.outsourcing.profit_total),
        pending: totals.pending + (item.outsourcing.payout_status === "pending" ? Number(item.outsourcing.outsourcer_total) : 0)
      }),
      { customer: 0, payout: 0, profit: 0, pending: 0 }
    );
  }, [outsourcingItems]);

  function replaceOrder(updated: OrderDetails, message: string) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess(message);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Controle de saidas, retornos e pagamentos</p>
          <h1 className="mt-1 text-3xl font-black text-ink">Terceirização</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setQuickCreateOpen(true)}>Cadastrar terceirizado</Button>
          <Button type="button" variant="secondary" onClick={() => void loadData()} disabled={loading}>Atualizar</Button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">{error}</div> : null}
      {success ? <div className="rounded-lg border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">{success}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "OS disponiveis", value: availableOrders.length, icon: Truck, money: false },
          { label: "Cobrado", value: financialSummary.customer, icon: BadgeDollarSign, money: true },
          { label: "Repasse", value: financialSummary.payout, icon: HandCoins, money: true },
          { label: "Lucro", value: financialSummary.profit, icon: PackageCheck, money: true }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-accent-soft text-accent-dark">
                <item.icon size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{item.label}</p>
                <p className="mt-1 text-2xl font-black text-ink">{item.money ? formatCurrency(item.value) : item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <OutsourcingAvailableOrders
        orders={availableOrders}
        availableQuantity={availableQuantity}
        loading={loading}
        onSend={setSendOrder}
      />
      <OutsourcingList
        items={outsourcingItems}
        loading={loading}
        onReturn={(order, outsourcing) => setReturnTarget({ order, outsourcing })}
        onPaid={(order) => replaceOrder(order, `Repasse da OS #${order.id} marcado como pago.`)}
        onError={setError}
      />

      <OutsourcingCreateModal
        open={Boolean(sendOrder)}
        order={sendOrder}
        availableQuantity={sendOrder ? availableQuantity(sendOrder) : 0}
        outsourcers={outsourcers}
        onClose={() => setSendOrder(null)}
        onCreated={(order) => replaceOrder(order, `Terceirização criada para a OS #${order.id}.`)}
        onQuickCreate={() => setQuickCreateOpen(true)}
      />
      <OutsourcerQuickCreateModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={(outsourcer) => {
          setOutsourcers((current) => [...current, outsourcer].sort((a, b) => a.name.localeCompare(b.name)));
          setSuccess(`${outsourcer.name} cadastrado e disponivel para selecao.`);
        }}
      />
      <OutsourcingReturnModal
        open={Boolean(returnTarget)}
        orderId={returnTarget?.order.id ?? null}
        outsourcing={returnTarget?.outsourcing ?? null}
        onClose={() => setReturnTarget(null)}
        onReturned={(order) => replaceOrder(order, `Retorno registrado na OS #${order.id}.`)}
      />
    </div>
  );
}
