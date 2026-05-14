"use client";

import { CheckCircle2, HandCoins } from "lucide-react";
import type { OrderDetails } from "@/components/orders/types";
import type { PayoutRow } from "@/components/finance/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";

type Props = {
  rows: PayoutRow[];
  loading: boolean;
  onPaid: (order: OrderDetails) => void;
  onError: (message: string) => void;
};

export function PayoutsTable({ rows, loading, onPaid, onError }: Props) {
  const [payingId, setPayingId] = useState<number | null>(null);

  async function pay(row: PayoutRow) {
    setPayingId(row.outsourcing.id);
    try {
      const updated = await api.post<OrderDetails>(
        `/orders/${row.order.id}/outsourcing/${row.outsourcing.id}/payout`,
        {}
      );
      onPaid(updated);
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Nao foi possivel marcar repasse como pago.");
    } finally {
      setPayingId(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Repasses de terceirização
          </p>
          <h2 className="mt-1 text-xl font-black text-ink">Terceirizados e lucro</h2>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<HandCoins size={20} />}
              title="Nenhum repasse encontrado"
              description="Terceirizacoes das OS aparecem aqui com valores, lucro e status de pagamento."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {[
                    "OS",
                    "Cliente",
                    "Terceirizado",
                    "Produto",
                    "Quantidade enviada",
                    "Repasse total",
                    "Lucro",
                    "Status repasse",
                    "Acoes"
                  ].map((heading) => (
                    <th key={heading} className="border-b border-line px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pending = row.outsourcing.payout_status === "pending";
                  return (
                    <tr key={row.outsourcing.id} className={pending ? "bg-warning/5" : "transition hover:bg-accent-soft/20"}>
                      <td className="border-b border-line/70 px-4 py-4 font-black text-ink">#{row.order.id}</td>
                      <td className="border-b border-line/70 px-4 py-4 font-semibold text-ink">{row.order.client.name}</td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {row.outsourcing.outsourcer?.name ?? "Sem terceirizado"}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">{outsourcingItemName(row)}</td>
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                        {row.outsourcing.quantity_sent}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                        {formatCurrency(row.outsourcing.outsourcer_total)}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-success">
                        {formatCurrency(row.outsourcing.profit_total)}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4">
                        <StatusBadge label={pending ? "Pendente" : "Pago"} status={pending ? "warning" : "done"} />
                      </td>
                      <td className="border-b border-line/70 px-4 py-4">
                        <Button
                          type="button"
                          variant={pending ? "primary" : "secondary"}
                          className="h-10 px-3"
                          isLoading={payingId === row.outsourcing.id}
                          disabled={!pending}
                          onClick={() => pay(row)}
                        >
                          <CheckCircle2 size={16} />
                          Marcar pago
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

function outsourcingItemName(row: PayoutRow) {
  const item = row.order.items.find((orderItem) => orderItem.id === row.outsourcing.order_item_id);
  return item?.product.name ?? "-";
}
