"use client";

import { CreditCard, ReceiptText } from "lucide-react";
import type { OrderDetails } from "@/components/orders/types";
import { financialLabels, financialTone } from "@/components/orders/status";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/format";

type Props = {
  orders: OrderDetails[];
  loading: boolean;
  onAddPayment: (order: OrderDetails) => void;
};

export function ReceivablesTable({ orders, loading, onAddPayment }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Recebimentos de OS</p>
          <h2 className="mt-1 text-xl font-black text-ink">Clientes e saldos</h2>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ReceiptText size={20} />}
              title="Nenhuma OS para receber"
              description="As ordens cadastradas aparecem aqui com total, pago e pendente."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {["OS", "Cliente", "Itens", "Total", "Pago", "Pendente", "Status financeiro", "Acoes"].map(
                    (heading) => (
                      <th key={heading} className="border-b border-line px-4 py-3">
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const needsAttention = order.financial_status !== "paid";
                  return (
                    <tr key={order.id} className={needsAttention ? "bg-warning/5" : "transition hover:bg-accent-soft/20"}>
                      <td className="border-b border-line/70 px-4 py-4 font-black text-ink">#{order.id}</td>
                      <td className="border-b border-line/70 px-4 py-4 font-semibold text-ink">{order.client.name}</td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">{itemSummary(order)}</td>
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {formatCurrency(order.amount_paid)}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-danger">
                        {formatCurrency(order.amount_due)}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4">
                        <StatusBadge
                          label={financialLabels[order.financial_status]}
                          status={financialTone(order.financial_status)}
                        />
                      </td>
                      <td className="border-b border-line/70 px-4 py-4">
                        <Button
                          type="button"
                          variant={needsAttention ? "primary" : "secondary"}
                          className="h-10 px-3"
                          disabled={!needsAttention}
                          onClick={() => onAddPayment(order)}
                        >
                          <CreditCard size={16} />
                          Adicionar pagamento
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function itemSummary(order: OrderDetails) {
  if (order.items.length === 0) return "-";
  if (order.items.length === 1) return order.items[0].product.name;
  return `${order.items.length} itens`;
}
